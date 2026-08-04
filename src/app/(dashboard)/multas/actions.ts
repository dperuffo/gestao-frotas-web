"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { empresaDonaDoVeiculoAcao, empresaOuIrmaDoGrupo } from "@/lib/empresasGrupo";
import type { Database } from "@/types/database.types";

export type MultaFormState = { erro?: string; ok?: boolean; avisoAnexo?: string } | undefined;

// Sanitiza só o CAMINHO no Storage (nunca visível pro usuário) — mesmo
// padrão de chamados/actions.ts e manutencao-preditiva/actions.ts.
function sanitizarNomeParaStorage(nomeOriginal: string): string {
  const combinacoesDiacriticas = new RegExp("[̀-ͯ]", "g");
  const semAcentos = nomeOriginal.normalize("NFD").replace(combinacoesDiacriticas, "");
  const seguro = semAcentos.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return seguro.slice(-150) || "arquivo";
}

const BUCKET_ANEXOS = "multas-anexos";

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

// Fase Onda-2 (benchmark TicketLog, item #4) — captura manual da multa
// (primeira versão, sem integração Detran/Renainf). O anexo (foto/PDF da
// notificação) sobe DEPOIS do insert, porque o caminho no Storage usa o id
// da multa — mesmo truque de manutencao-preditiva/fretes-evidencias.
export async function criarMultaAcao(empresaId: string, _prev: MultaFormState, formData: FormData): Promise<MultaFormState> {
  const supabase = await createClient();
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase();
  const dataInfracao = String(formData.get("data_infracao") ?? "").trim();
  const dataLimiteIndicacao = String(formData.get("data_limite_indicacao") ?? "").trim() || null;
  const numeroAit = String(formData.get("numero_ait") ?? "").trim() || null;
  const orgaoAutuador = String(formData.get("orgao_autuador") ?? "").trim() || null;
  const localInfracao = String(formData.get("local_infracao") ?? "").trim() || null;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const gravidade = String(formData.get("gravidade") ?? "").trim() || null;
  const pontos = numeroOuNull(formData.get("pontos"));
  const valorOriginal = numeroOuNull(formData.get("valor_original"));
  const valorDesconto = numeroOuNull(formData.get("valor_desconto"));
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

  if (!placa) return { erro: "Placa é obrigatória." };
  if (!dataInfracao) return { erro: "Data da infração é obrigatória." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fase Reuso-Operacional-Grupo (Fase 2) — o custo da multa fica com a
  // empresa DONA do cadastro do veículo (mesma decisão já usada em
  // TCO/KPIs), não com a empresa selecionada na tela. Se a placa pertencer
  // a uma empresa fora do grupo econômico da empresa selecionada, rejeita.
  const empresaDonaId = await empresaDonaDoVeiculoAcao(supabase, placa);
  let empresaFinalId = empresaId;
  if (empresaDonaId) {
    const pertenceAoGrupo = await empresaOuIrmaDoGrupo(supabase, empresaId, empresaDonaId);
    if (!pertenceAoGrupo) {
      return { erro: "Essa placa não pertence à sua empresa nem a uma empresa do mesmo grupo econômico." };
    }
    empresaFinalId = empresaDonaId;
  }

  const { data: inserida, error } = await supabase
    .from("multas")
    .insert({
      empresa_id: empresaFinalId,
      placa,
      data_infracao: dataInfracao,
      data_limite_indicacao: dataLimiteIndicacao,
      numero_ait: numeroAit,
      orgao_autuador: orgaoAutuador,
      local_infracao: localInfracao,
      descricao,
      gravidade,
      pontos,
      valor_original: valorOriginal,
      valor_desconto: valorDesconto,
      observacoes,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível registrar a multa: ${error.message}` };

  // Fase Onda-2 (pedido do Daniel: "Custos com multas e oficinas de
  // manutenção devem entrar no contas a pagar do cliente para gestão
  // financeira") — lança automaticamente em contas_pagar, usando o valor
  // COM desconto quando informado (é o que o cliente efetivamente vai
  // desembolsar se indicar/pagar dentro do prazo). Best-effort: se falhar,
  // a multa já está salva — só não aparece no financeiro até editar
  // manualmente lá.
  const valorParaFinanceiro = valorDesconto ?? valorOriginal;
  if (valorParaFinanceiro && valorParaFinanceiro > 0) {
    await supabase
      .from("contas_pagar")
      .insert({
        empresa_id: empresaFinalId,
        origem: "multa",
        referencia_id: inserida.id,
        credor_nome: orgaoAutuador ?? "Multa de trânsito",
        descricao: `Multa ${numeroAit ? `AIT ${numeroAit} — ` : ""}${placa}${descricao ? ` — ${descricao}` : ""}`,
        valor_original: valorParaFinanceiro,
        vencimento: dataLimiteIndicacao ?? dataInfracao,
        criado_por: user?.email ?? null,
      })
      .then(({ error: erroContaPagar }) => {
        if (erroContaPagar) console.error("[multas] falha ao lançar em contas_pagar (ignorado):", erroContaPagar);
      });
  }

  const anexo = formData.get("anexo");
  let avisoAnexo: string | undefined;
  if (anexo instanceof File && anexo.size > 0) {
    const caminho = `${inserida.id}/${Date.now()}_${sanitizarNomeParaStorage(anexo.name)}`;
    const { error: erroUpload } = await supabase.storage.from(BUCKET_ANEXOS).upload(caminho, anexo, {
      contentType: anexo.type || undefined,
    });
    if (erroUpload) {
      avisoAnexo = "Multa registrada, mas não foi possível salvar o anexo.";
    } else {
      const { error: erroAnexo } = await supabase.from("multas").update({ anexo_path: caminho }).eq("id", inserida.id);
      if (erroAnexo) avisoAnexo = "Multa registrada, mas não foi possível vincular o anexo.";
    }
  }

  revalidatePath("/multas");
  return { ok: true, avisoAnexo };
}

// Indica o condutor infrator — o gestor pode aceitar a sugestão (vínculo
// Motorista<->Veículo ativo na data da infração, resolvido na tela) ou
// escolher outro motorista manualmente.
export async function indicarCondutorAcao(multaId: string, motoristaId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fase Reuso-Operacional-Grupo (Fase 2) — fecha o mesmo tipo de brecha já
  // corrigida em Fretes/Planos de Viagem/MDF-e: antes, qualquer motorista_id
  // era aceito sem checar se ele pertence à empresa da multa (ou a uma
  // irmã do grupo).
  const [{ data: multa }, { data: motorista }] = await Promise.all([
    supabase.from("multas").select("empresa_id").eq("id", multaId).maybeSingle(),
    supabase.from("motoristas").select("empresa_id").eq("id", motoristaId).maybeSingle(),
  ]);
  if (!multa) throw new Error("Multa não encontrada.");
  if (!motorista) throw new Error("Motorista não encontrado.");
  const pertenceAoGrupo = await empresaOuIrmaDoGrupo(supabase, multa.empresa_id, motorista.empresa_id);
  if (!pertenceAoGrupo) {
    throw new Error("Esse motorista não pertence à empresa da multa nem a uma empresa do mesmo grupo econômico.");
  }

  const { error } = await supabase
    .from("multas")
    .update({
      motorista_id: motoristaId,
      status: "indicada",
      indicado_em: new Date().toISOString(),
      indicado_por: user?.email ?? null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", multaId);

  if (error) throw new Error(error.message);
  revalidatePath("/multas");
  revalidatePath(`/multas/${multaId}`);
}

export async function atualizarStatusMultaAcao(multaId: string, novoStatus: string) {
  const supabase = await createClient();
  const patch: Database["public"]["Tables"]["multas"]["Update"] = {
    status: novoStatus,
    atualizado_em: new Date().toISOString(),
  };
  if (novoStatus === "paga") patch.pago_em = new Date().toISOString();

  const { error } = await supabase.from("multas").update(patch).eq("id", multaId);
  if (error) throw new Error(error.message);

  // Mantém o contas_pagar lançado em criarMultaAcao sincronizado (mesma
  // blindagem best-effort — a mudança de status da multa não pode falhar
  // por causa do financeiro).
  if (novoStatus === "paga" || novoStatus === "cancelada") {
    const { data: contaVinculada } = await supabase
      .from("contas_pagar")
      .select("id, valor_original")
      .eq("origem", "multa")
      .eq("referencia_id", multaId)
      .maybeSingle();
    if (contaVinculada) {
      const patchConta: Database["public"]["Tables"]["contas_pagar"]["Update"] =
        novoStatus === "paga"
          ? { status: "pago", valor_pago: contaVinculada.valor_original, pago_em: new Date().toISOString() }
          : { status: "cancelado" };
      await supabase
        .from("contas_pagar")
        .update(patchConta)
        .eq("id", contaVinculada.id)
        .then(({ error: erroConta }) => {
          if (erroConta) console.error("[multas] falha ao sincronizar contas_pagar (ignorado):", erroConta);
        });
    }
  }

  revalidatePath("/multas");
  revalidatePath(`/multas/${multaId}`);
  revalidatePath("/financeiro");
}

export async function excluirMultaAcao(id: string) {
  const supabase = await createClient();

  const { data: registro } = await supabase.from("multas").select("anexo_path").eq("id", id).maybeSingle();
  if (registro?.anexo_path) {
    await supabase.storage.from(BUCKET_ANEXOS).remove([registro.anexo_path]).catch(() => {});
  }

  // Remove também o lançamento em contas_pagar gerado junto com a multa
  // (best-effort — não bloqueia a exclusão da multa se falhar).
  await supabase
    .from("contas_pagar")
    .delete()
    .eq("origem", "multa")
    .eq("referencia_id", id)
    .then(({ error: erroConta }) => {
      if (erroConta) console.error("[multas] falha ao remover contas_pagar vinculada (ignorado):", erroConta);
    });

  const { error } = await supabase.from("multas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/multas");
  revalidatePath("/financeiro");
}

// Bolinha do menu — multas pendentes de indicação com prazo vencendo nos
// próximos 7 dias (ou já vencido), mesma blindagem "falha vira 0" das
// demais contagens em layout.tsx.
export async function contarMultasPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return 0;

  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user.email });
  if (!minhasEmpresasIds || minhasEmpresasIds.length === 0) return 0;

  const emSeteDias = new Date();
  emSeteDias.setDate(emSeteDias.getDate() + 7);

  const { count } = await supabase
    .from("multas")
    .select("id", { count: "exact", head: true })
    .in("empresa_id", minhasEmpresasIds)
    .eq("status", "pendente_indicacao")
    .not("data_limite_indicacao", "is", null)
    .lte("data_limite_indicacao", emSeteDias.toISOString().slice(0, 10));

  return count ?? 0;
}
