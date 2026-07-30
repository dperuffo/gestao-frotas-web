"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ManutencaoFormState = { erro?: string; ok?: boolean; avisoFotos?: string } | undefined;

function numeroOuNull(valor: FormDataEntryValue | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Sanitiza só o CAMINHO no Storage (nunca visível pro usuário) — mesmo
// padrão de chamados/actions.ts::sanitizarNomeParaStorage.
function sanitizarNomeParaStorage(nomeOriginal: string): string {
  const combinacoesDiacriticas = new RegExp("[̀-ͯ]", "g");
  const semAcentos = nomeOriginal.normalize("NFD").replace(combinacoesDiacriticas, "");
  const seguro = semAcentos.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return seguro.slice(-150) || "arquivo";
}

const BUCKET_EVIDENCIAS = "manutencao-evidencias";

// Registra uma manutenção realizada — mesma tabela (manutencoes_realizadas)
// e mesmo formato de itens_realizados (texto livre, um array de serviços)
// já usados pelo app Flutter de produção, pra manter os dois apps
// compatíveis com o mesmo histórico.
export async function registrarManutencaoAcao(
  empresaId: string,
  _prev: ManutencaoFormState,
  formData: FormData
): Promise<ManutencaoFormState> {
  const supabase = await createClient();
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase();
  const dataManutencao = String(formData.get("data_manutencao") ?? "").trim();
  const hodometro = numeroOuNull(formData.get("hodometro"));
  const tecnico = String(formData.get("tecnico") ?? "").trim() || null;
  const oficina = String(formData.get("oficina") ?? "").trim() || null;
  const custoTotal = numeroOuNull(formData.get("custo_total"));
  const diasParado = numeroOuNull(formData.get("dias_parado"));
  const obsGerais = String(formData.get("obs_gerais") ?? "").trim() || null;
  const itens = formData.getAll("itens_realizados").map((v) => String(v));
  // Fase Indicadores-da-Frota (30/07/2026) — alimenta o KPI de proporção
  // corretiva/preventiva (kpis_frota_resumo). Registro antigo fica com
  // tipo=null (não classificado); daqui pra frente é sempre obrigatório.
  const tipo = String(formData.get("tipo") ?? "").trim() || null;

  if (!placa) return { erro: "Placa é obrigatória." };
  if (!dataManutencao) return { erro: "Data da manutenção é obrigatória." };
  if (itens.length === 0) return { erro: "Selecione ao menos um item realizado." };
  if (tipo !== "Preventiva" && tipo !== "Corretiva") return { erro: "Selecione o tipo: Preventiva ou Corretiva." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: veiculo } = await supabase
    .from("cadastro_veiculos")
    .select("cnpj_frota")
    .eq("placa", placa)
    .maybeSingle();

  const { data: inserida, error } = await supabase
    .from("manutencoes_realizadas")
    .insert({
      empresa_id: empresaId,
      cnpj_frota: veiculo?.cnpj_frota ?? "",
      placa,
      data_manutencao: dataManutencao,
      hodometro,
      tecnico,
      oficina,
      custo_total: custoTotal,
      dias_parado: diasParado,
      tipo,
      itens_realizados: itens,
      obs_gerais: obsGerais,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível registrar: ${error.message}` };

  // Fase Checklist-Digital-Manutenção — pedido do Daniel após o benchmark
  // com a TicketLog: evidência fotográfica do serviço, pra compliance. Sobe
  // DEPOIS do insert porque o caminho no Storage usa o id da manutenção
  // (mesmo truque de fretes-evidencias). Best-effort: se a foto falhar, o
  // registro da manutenção já está salvo — só avisamos, não desfazemos.
  const fotos = formData.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
  let avisoFotos: string | undefined;
  if (fotos.length > 0) {
    const caminhos: string[] = [];
    for (const arquivo of fotos) {
      const caminho = `${inserida.id}/${Date.now()}_${sanitizarNomeParaStorage(arquivo.name)}`;
      const { error: erroUpload } = await supabase.storage.from(BUCKET_EVIDENCIAS).upload(caminho, arquivo, {
        contentType: arquivo.type || undefined,
      });
      if (erroUpload) {
        avisoFotos = "Manutenção registrada, mas não foi possível salvar uma ou mais fotos.";
        continue;
      }
      caminhos.push(caminho);
    }
    if (caminhos.length > 0) {
      const { error: erroFotos } = await supabase
        .from("manutencoes_realizadas")
        .update({ fotos: caminhos })
        .eq("id", inserida.id);
      if (erroFotos) avisoFotos = "Manutenção registrada, mas não foi possível vincular as fotos.";
    }
  }

  revalidatePath(`/manutencao-preditiva/${placa}`);
  revalidatePath("/manutencao-preditiva");
  return { ok: true, avisoFotos };
}

export async function excluirManutencaoAcao(id: number, placa: string) {
  const supabase = await createClient();

  // Best-effort: apaga as fotos do Storage antes do registro — se falhar,
  // segue com a exclusão do registro mesmo assim (não deixa lixo bloquear a
  // ação principal que o usuário pediu).
  const { data: registro } = await supabase.from("manutencoes_realizadas").select("fotos").eq("id", id).maybeSingle();
  if (registro?.fotos && registro.fotos.length > 0) {
    await supabase.storage.from(BUCKET_EVIDENCIAS).remove(registro.fotos).catch(() => {});
  }

  const { error } = await supabase.from("manutencoes_realizadas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manutencao-preditiva/${placa}`);
  revalidatePath("/manutencao-preditiva");
}
