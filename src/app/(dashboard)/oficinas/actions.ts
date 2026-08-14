"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Fase Onda-2 (benchmark TicketLog, item #5) — Rede de Oficinas
// Credenciadas com Orçamento, fluxo simples (v1): o cliente solicita, e
// como não existe portal pra oficina responder ainda, o próprio gestor
// registra o retorno recebido por telefone/e-mail. Ver comentário completo
// na migração rede_oficinas_credenciadas.
//
// Fase marketplace-pecas (04/08/2026, item 7 do benchmark FNI vs KMM,
// Grupo 2) — evoluiu de "1 solicitação = 1 oficina" pra "1 pedido pode ir
// pra N oficinas, cada uma responde com sua própria proposta". Ver migração
// marketplace_pecas_multi_fornecedor: a tabela antiga virou
// `propostas_orcamento_oficina` (1 linha por oficina) e ganhou uma tabela
// pai nova `pedidos_orcamento_oficina` (1 linha por solicitação do
// cliente, independente de quantas oficinas escolheu).

export type SolicitarOrcamentoState = { erro?: string; ok?: boolean } | undefined;

// Substitui a antiga solicitarOrcamentoAcao (1 oficina) — agora recebe uma
// lista de oficinas e cria 1 pedido + N propostas (1 por oficina
// escolhida), todas partindo do mesmo status "solicitado".
export async function solicitarOrcamentoMultiAcao(
  empresaId: string,
  oficinaIds: string[],
  _prev: SolicitarOrcamentoState,
  formData: FormData
): Promise<SolicitarOrcamentoState> {
  if (oficinaIds.length === 0) return { erro: "Selecione ao menos uma oficina para cotar." };

  const supabase = await createClient();
  const placa = String(formData.get("placa") ?? "").trim().toUpperCase() || null;
  const descricaoServico = String(formData.get("descricao_servico") ?? "").trim();

  if (!descricaoServico) return { erro: "Descreva o serviço desejado." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos_orcamento_oficina")
    .insert({
      empresa_id: empresaId,
      placa,
      descricao_servico: descricaoServico,
      criado_por: user?.email ?? null,
    })
    .select("id")
    .single();

  if (erroPedido || !pedido) return { erro: `Não foi possível registrar o pedido: ${erroPedido?.message ?? "erro desconhecido"}` };

  const { error: erroPropostas } = await supabase.from("propostas_orcamento_oficina").insert(
    oficinaIds.map((oficinaId) => ({
      pedido_id: pedido.id,
      empresa_id: empresaId,
      oficina_id: oficinaId,
      placa,
      descricao_servico: descricaoServico,
      criado_por: user?.email ?? null,
    }))
  );

  if (erroPropostas) return { erro: `Pedido criado, mas houve falha ao notificar as oficinas: ${erroPropostas.message}` };

  revalidatePath("/oficinas");
  return { ok: true };
}

// Registra o retorno da oficina (valor, prazo) que o gestor recebeu por
// fora da plataforma — não é um "aceite" automático, só documenta a
// cotação recebida. Continua atuando sobre uma PROPOSTA (1 oficina), agora
// na tabela renomeada.
export async function registrarRespostaOrcamentoAcao(id: string, formData: FormData) {
  const supabase = await createClient();
  const valorOrcado = String(formData.get("valor_orcado") ?? "").trim();
  const prazoExecucao = String(formData.get("prazo_execucao") ?? "").trim() || null;
  const observacoesOficina = String(formData.get("observacoes_oficina") ?? "").trim() || null;

  const { error } = await supabase
    .from("propostas_orcamento_oficina")
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

// Decide uma PROPOSTA específica dentro de um pedido. Ao ACEITAR: marca o
// pedido pai como "decidido" (com a oficina vencedora) e recusa
// automaticamente as demais propostas do mesmo pedido que ainda estivessem
// em aberto — só uma oficina executa o serviço, não faz sentido deixar as
// outras penduradas em "aguardando retorno"/"orçamento recebido".
export async function decidirOrcamentoAcao(id: string, decisao: "aceito" | "recusado") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("propostas_orcamento_oficina")
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
    const { data: proposta } = await supabase
      .from("propostas_orcamento_oficina")
      .select("pedido_id, oficina_id, empresa_id, placa, descricao_servico, valor_orcado, oficinas_credenciadas(nome, cnpj)")
      .eq("id", id)
      .maybeSingle();
    const oficina = proposta?.oficinas_credenciadas as unknown as { nome: string; cnpj: string | null } | null;

    if (proposta?.pedido_id) {
      await supabase
        .from("pedidos_orcamento_oficina")
        .update({ status: "decidido", oficina_vencedora_id: proposta.oficina_id, atualizado_em: new Date().toISOString() })
        .eq("id", proposta.pedido_id);

      // Recusa automaticamente as demais propostas do mesmo pedido que
      // ainda estavam em aberto (só a vencedora fica como "aceito").
      await supabase
        .from("propostas_orcamento_oficina")
        .update({ status: "recusado", atualizado_em: new Date().toISOString() })
        .eq("pedido_id", proposta.pedido_id)
        .neq("id", id)
        .in("status", ["solicitado", "respondido"]);
    }

    if (proposta?.valor_orcado && proposta.valor_orcado > 0) {
      await supabase
        .from("contas_pagar")
        .insert({
          empresa_id: proposta.empresa_id,
          origem: "orcamento_oficina",
          referencia_id: id,
          credor_nome: oficina?.nome ?? "Oficina credenciada",
          credor_cnpj: oficina?.cnpj ?? null,
          descricao: `${proposta.descricao_servico}${proposta.placa ? ` — ${proposta.placa}` : ""}`,
          valor_original: proposta.valor_orcado,
          vencimento: new Date().toISOString().slice(0, 10),
          criado_por: user?.email ?? null,
        })
        .then(({ error: erroContaPagar }) => {
          if (erroContaPagar) void logger.error("oficinas", "Falha ao lançar em contas_pagar (ignorado)", erroContaPagar);
        });
    }
  }

  revalidatePath("/oficinas");
  revalidatePath("/financeiro");
}
