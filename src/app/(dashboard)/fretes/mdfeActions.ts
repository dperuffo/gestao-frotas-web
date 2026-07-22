"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterProvedorFiscal } from "@/lib/fiscal";
import type { DadosEmissaoMdfe, ProvedorNome } from "@/lib/fiscal";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fase P0.3 (plano FNI_Plano_Implementacao_P0.md) — MDF-e: "1 viagem = 1
// MDF-e por veículo, agrupando N CT-e". Aqui, 1 frete = 1 viagem (o app
// ainda não tem uma entidade "viagem" separada — mesmo escopo pragmático já
// usado na P0.2 pro CT-e). Depende de já existir pelo menos um CT-e
// autorizado no frete (fretes_cte, Fase P0.2).

async function empresaPertenceAoUsuario(supabase: Supabase, empresaId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email === "d.peruffo@gmail.com") return true;
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil === "admin") return true;
  const { data: minhas } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  return (minhas ?? []).includes(empresaId);
}

async function usuarioAtualEmail(supabase: Supabase): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export type ResultadoIniciarViagemAcao = { erro?: string; sucesso?: { numeroMdfe: string; chaveAcesso: string } };

export async function iniciarViagemAcao(
  freteId: string,
  empresaId: string,
  formData: FormData
): Promise<ResultadoIniciarViagemAcao> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para iniciar viagem neste frete." };
  }

  const { data: frete } = await supabase
    .from("fretes")
    .select("id, coleta_uf, entrega_uf, motorista_id")
    .eq("id", freteId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!frete) return { erro: "Frete não encontrado." };

  const { data: fiscal } = await supabase
    .from("empresas_fiscal")
    .select("provedor, provedor_ref, ambiente, serie_mdfe, proximo_numero_mdfe")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!fiscal?.provedor_ref) {
    return { erro: "Configure os dados fiscais em Fiscal antes de iniciar uma viagem (cadastro do emitente no provedor)." };
  }

  const { data: mdfeAberto } = await supabase
    .from("mdfe")
    .select("id")
    .eq("frete_id", freteId)
    .in("status", ["enviando", "autorizado"])
    .maybeSingle();
  if (mdfeAberto) return { erro: "Já existe um MDF-e ativo para este frete — encerre ou cancele antes de iniciar outro." };

  const { data: ctesAutorizados } = await supabase
    .from("fretes_cte")
    .select("chave_acesso, chaves_nfe")
    .eq("frete_id", freteId)
    .eq("status", "autorizado")
    .not("chave_acesso", "is", null);
  const chavesCte = (ctesAutorizados ?? []).map((c) => c.chave_acesso).filter((c): c is string => Boolean(c));
  if (chavesCte.length === 0) {
    return { erro: "É preciso ter ao menos um CT-e autorizado neste frete antes de iniciar a viagem." };
  }
  const chavesNfe = Array.from(new Set((ctesAutorizados ?? []).flatMap((c) => c.chaves_nfe ?? [])));

  const placaVeiculo = String(formData.get("placa_veiculo") ?? "").trim().toUpperCase();
  if (!placaVeiculo) return { erro: "Informe a placa do veículo." };
  const veiculoId = String(formData.get("veiculo_id") ?? "").trim() || null;

  const condutorNome = String(formData.get("condutor_nome") ?? "").trim();
  const condutorCpf = String(formData.get("condutor_cpf") ?? "").replace(/\D/g, "");
  if (!condutorNome || condutorCpf.length !== 11) {
    return { erro: "Informe nome e CPF (11 dígitos) do condutor." };
  }
  const condutorAdicionalNome = String(formData.get("condutor_adicional_nome") ?? "").trim() || null;
  const condutorAdicionalCpf = String(formData.get("condutor_adicional_cpf") ?? "").replace(/\D/g, "") || null;

  const ufCarregamento = String(formData.get("uf_carregamento") ?? frete.coleta_uf ?? "").trim().toUpperCase();
  const ufDescarregamento = String(formData.get("uf_descarregamento") ?? frete.entrega_uf ?? "").trim().toUpperCase();
  if (!ufCarregamento || !ufDescarregamento) return { erro: "Informe a UF de carregamento e de descarregamento." };

  const percursoUf = String(formData.get("percurso_uf") ?? "")
    .split(/[\s,;]+/)
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);

  const criadoPor = await usuarioAtualEmail(supabase);
  const serie = fiscal.serie_mdfe;
  const numero = fiscal.proximo_numero_mdfe;

  const { data: linha, error: erroInsert } = await supabase
    .from("mdfe")
    .insert({
      frete_id: freteId,
      empresa_id: empresaId,
      veiculo_id: veiculoId,
      placa_veiculo: placaVeiculo,
      motorista_id: frete.motorista_id,
      condutor_nome: condutorNome,
      condutor_cpf: condutorCpf,
      condutor_adicional_nome: condutorAdicionalNome,
      condutor_adicional_cpf: condutorAdicionalCpf,
      uf_carregamento: ufCarregamento,
      uf_descarregamento: ufDescarregamento,
      percurso_uf: percursoUf,
      numero_mdfe: String(numero),
      serie: String(serie),
      status: "enviando",
      provedor_ref: fiscal.provedor_ref,
      provedor_nome: fiscal.provedor,
      ambiente: fiscal.ambiente,
      criado_por: criadoPor,
    })
    .select("id")
    .single();
  if (erroInsert || !linha) {
    return { erro: `Não foi possível iniciar a viagem: ${erroInsert?.message ?? "erro desconhecido"}.` };
  }

  const documentos = [
    ...chavesCte.map((chave) => ({ mdfe_id: linha.id, tipo: "cte" as const, chave_acesso: chave })),
    ...chavesNfe.map((chave) => ({ mdfe_id: linha.id, tipo: "nfe" as const, chave_acesso: chave })),
  ];
  if (documentos.length > 0) {
    await supabase.from("mdfe_documentos").insert(documentos);
  }

  const dados: DadosEmissaoMdfe = {
    provedorRef: fiscal.provedor_ref,
    ambiente: fiscal.ambiente as "homologacao" | "producao",
    serie,
    numero,
    ufCarregamento,
    ufDescarregamento,
    percursoUf,
    placaVeiculo,
    condutorNome,
    condutorCpf,
    condutorAdicionalNome,
    condutorAdicionalCpf,
    chavesCte,
    chavesNfe,
  };

  try {
    const impl = obterProvedorFiscal(fiscal.provedor as ProvedorNome);
    const resultado = await impl.emitirMdfe(dados);

    if (!resultado.ok) {
      await supabase.from("mdfe").update({ status: "rejeitado", motivo_rejeicao: resultado.erro, atualizado_em: new Date().toISOString() }).eq("id", linha.id);
      return { erro: resultado.erro };
    }

    if (resultado.situacao === "rejeitado") {
      await supabase
        .from("mdfe")
        .update({ status: "rejeitado", motivo_rejeicao: resultado.motivoRejeicao, atualizado_em: new Date().toISOString() })
        .eq("id", linha.id);
      revalidatePath(`/fretes/${freteId}`);
      return { erro: `MDF-e rejeitado pela SEFAZ: ${resultado.motivoRejeicao}` };
    }

    await supabase
      .from("mdfe")
      .update({
        status: "autorizado",
        chave_acesso: resultado.chaveAcesso,
        numero_mdfe: resultado.numeroMdfe,
        serie: resultado.serieMdfe,
        protocolo_autorizacao: resultado.protocoloAutorizacao,
        data_emissao: resultado.dataAutorizacao,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", linha.id);

    await supabase.from("empresas_fiscal").update({ proximo_numero_mdfe: numero + 1 }).eq("empresa_id", empresaId);

    revalidatePath(`/fretes/${freteId}`);
    return { sucesso: { numeroMdfe: resultado.numeroMdfe, chaveAcesso: resultado.chaveAcesso } };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha ao emitir o MDF-e.";
    await supabase.from("mdfe").update({ status: "rejeitado", motivo_rejeicao: mensagem, atualizado_em: new Date().toISOString() }).eq("id", linha.id);
    return { erro: mensagem };
  }
}

export type ResultadoAcaoMdfe = { erro?: string; ok?: string };

async function carregarMdfeDoUsuario(supabase: Supabase, mdfeId: string, empresaId: string) {
  const { data: mdfeRow } = await supabase
    .from("mdfe")
    .select("id, frete_id, status, chave_acesso, provedor_ref, provedor_nome, empresa_id")
    .eq("id", mdfeId)
    .maybeSingle();
  if (!mdfeRow || mdfeRow.empresa_id !== empresaId) return null;
  return mdfeRow;
}

export async function encerrarMdfeAcao(mdfeId: string, empresaId: string): Promise<ResultadoAcaoMdfe> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para encerrar este MDF-e." };
  }

  const mdfeRow = await carregarMdfeDoUsuario(supabase, mdfeId, empresaId);
  if (!mdfeRow) return { erro: "MDF-e não encontrado." };
  if (mdfeRow.status !== "autorizado") return { erro: `Este MDF-e está com status "${mdfeRow.status}" — só é possível encerrar um MDF-e autorizado.` };
  if (!mdfeRow.chave_acesso) return { erro: "MDF-e sem chave de acesso — dado inconsistente." };

  try {
    const impl = obterProvedorFiscal(mdfeRow.provedor_nome as ProvedorNome);
    const resultado = await impl.encerrarMdfe(mdfeRow.provedor_ref ?? "", mdfeRow.chave_acesso);
    if (!resultado.ok) return { erro: resultado.erro };

    await supabase.from("mdfe").update({ status: "encerrado", encerrado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq("id", mdfeId);

    revalidatePath(`/fretes/${mdfeRow.frete_id}`);
    return { ok: "Viagem encerrada — MDF-e baixado com sucesso." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao encerrar o MDF-e." };
  }
}

export async function cancelarMdfeAcao(mdfeId: string, empresaId: string, justificativa: string): Promise<ResultadoAcaoMdfe> {
  const supabase = await createClient();
  if (!(await empresaPertenceAoUsuario(supabase, empresaId))) {
    return { erro: "Você não tem permissão para cancelar este MDF-e." };
  }

  const mdfeRow = await carregarMdfeDoUsuario(supabase, mdfeId, empresaId);
  if (!mdfeRow) return { erro: "MDF-e não encontrado." };
  if (mdfeRow.status !== "autorizado") return { erro: `Este MDF-e está com status "${mdfeRow.status}" — só é possível cancelar um MDF-e autorizado (antes de encerrar).` };
  if (!mdfeRow.chave_acesso) return { erro: "MDF-e sem chave de acesso — dado inconsistente." };

  try {
    const impl = obterProvedorFiscal(mdfeRow.provedor_nome as ProvedorNome);
    const resultado = await impl.cancelarMdfe(mdfeRow.provedor_ref ?? "", mdfeRow.chave_acesso, justificativa);
    if (!resultado.ok) return { erro: resultado.erro };

    await supabase
      .from("mdfe")
      .update({
        status: "cancelado",
        cancelado_em: new Date().toISOString(),
        motivo_rejeicao: `Cancelado: ${justificativa}`,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", mdfeId);

    revalidatePath(`/fretes/${mdfeRow.frete_id}`);
    return { ok: "MDF-e cancelado com sucesso." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao cancelar o MDF-e." };
  }
}
