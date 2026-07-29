"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase Onda-2 (benchmark TicketLog, item #5) — Rede de Oficinas
// Credenciadas com Orçamento, fluxo simples (v1): o cliente solicita, e
// como não existe portal pra oficina responder ainda, o próprio gestor
// registra o retorno recebido por telefone/e-mail. Ver comentário completo
// na migração rede_oficinas_credenciadas.

export type SolicitarOrcamentoState = { erro?: string; ok?: boolean } | undefined;

export async function solicitarOrcamentoAcao(
  empresaId: string,
  oficinaId: string,
  _prev: SolicitarOrcamentoState,
  formData: FormData
): Promise<SolicitarOrcamentoState> {
  const supabase = await createClient();
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase() || null;
  const descricaoServico = String(formData.get("descricao_servico") ?? "").trim();

  if (!descricaoServico) return { erro: "Descreva o serviço desejado." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("solicitacoes_orcamento_oficina").insert({
    empresa_id: empresaId,
    oficina_id: oficinaId,
    placa,
    descricao_servico: descricaoServico,
    criado_por: user?.email ?? null,
  });

  if (error) return { erro: `Não foi possível registrar a solicitação: ${error.message}` };

  revalidatePath("/oficinas");
  return { ok: true };
}

// Registra o retorno da oficina (valor, prazo) que o gestor recebeu por
// fora da plataforma — não é um "aceite" automático, só documenta a
// cotação recebida.
export async function registrarRespostaOrcamentoAcao(id: string, formData: FormData) {
  const supabase = await createClient();
  const valorOrcado = String(formData.get("valor_orcado") ?? "").trim();
  const prazoExecucao = String(formData.get("prazo_execucao") ?? "").trim() || null;
  const observacoesOficina = String(formData.get("observacoes_oficina") ?? "").trim() || null;

  const { error } = await supabase
    .from("solicitacoes_orcamento_oficina")
    .update({
      valor_orcado: valorOrcado ? Number(valorOrcado.replace(",", ".")) : null,
      prazo_execucao: prazoExecucao,
      observacoes_oficina: observacoesOficina,
      status: "respondido",
      respondido_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/oficinas");
}

export async function decidirOrcamentoAcao(id: string, decisao: "aceito" | "recusado") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("solicitacoes_orcamento_oficina")
    .update({ status: decisao, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Fase Onda-2 (pedido do Daniel: "Custos com multas e oficinas de
  // manutenção devem entrar no contas a pagar do cliente para gestão
  // financeira") — só ao ACEITAR o orçamento existe de fato uma obrigação
  // financeira (antes disso é só cotação). Best-effort, mesma blindagem de
  // multas/actions.ts.
  if (decisao === "aceito") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: solicitacao } = await supabase
      .from("solicitacoes_orcamento_oficina")
      .select("empresa_id, placa, descricao_servico, valor_orcado, oficinas_credenciadas(nome, cnpj)")
      .eq("id", id)
      .maybeSingle();
    const oficina = solicitacao?.oficinas_credenciadas as unknown as { nome: string; cnpj: string | null } | null;
    if (solicitacao?.valor_orcado && solicitacao.valor_orcado > 0) {
      await supabase
        .from("contas_pagar")
        .insert({
          empresa_id: solicitacao.empresa_id,
          origem: "orcamento_oficina",
          referencia_id: id,
          credor_nome: oficina?.nome ?? "Oficina credenciada",
          credor_cnpj: oficina?.cnpj ?? null,
          descricao: `${solicitacao.descricao_servico}${solicitacao.placa ? ` — ${solicitacao.placa}` : ""}`,
          valor_original: solicitacao.valor_orcado,
          vencimento: new Date().toISOString().slice(0, 10),
          criado_por: user?.email ?? null,
        })
        .then(({ error: erroContaPagar }) => {
          if (erroContaPagar) console.error("[oficinas] falha ao lançar em contas_pagar (ignorado):", erroContaPagar);
        });
    }
  }

  revalidatePath("/oficinas");
  revalidatePath("/financeiro");
}
