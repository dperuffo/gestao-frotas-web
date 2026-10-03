"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";

// Fase 5 PDV (03/10/2026, pedido do Daniel) — visão "Abastecimentos negados"
// do cliente: abastecimentos PDV negados por regras do cliente, que o gestor
// pode liberar (ou recusar) enquanto o pedido está dentro da validade. A
// regra de quem pode decidir e a janela de validade ficam no banco
// (decidir_abastecimento_negado_pdv) — aqui é só a casca.

export type ViolacaoRegra = { codigo: string; titulo: string; detalhe: string; corrigivel: boolean };

export type AbastecimentoNegado = {
  id: number;
  codigo_abastecimento: string;
  placa: string | null;
  motorista_nome: string | null;
  motorista_cpf: string | null;
  combustivel: string | null;
  litros: number | null;
  valor_total_combustivel: number | null;
  hodometro: number | null;
  regras_violadas: ViolacaoRegra[] | null;
  criado_em: string;
  otp_expira_em: string;
  status_atual: string;
  posto_nome: string | null;
  liberacao_decisao: "liberado" | "recusado" | null;
  liberacao_decidida_em: string | null;
  liberacao_decidida_por: string | null;
  liberacao_justificativa: string | null;
  situacao: "pendente" | "liberado" | "recusado" | "expirado";
};

// Mesmo critério das outras bolinhas do menu: só conta quando há uma empresa
// atual resolvida (evita número ambíguo pra quem gerencia várias).
export async function contarAbastecimentosNegadosAcao(): Promise<number> {
  const supabase = await createClient();
  const { empresaSelecionada } = await resolverEmpresaAtual(supabase);
  if (!empresaSelecionada) return 0;
  const { data } = await supabase.rpc("contar_abastecimentos_negados_pendentes_pdv", {
    p_empresa_id: empresaSelecionada,
  });
  return data ?? 0;
}

export type DecisaoResultado = { ok: true } | { ok: false; erro: string };

const MENSAGENS: Record<string, string> = {
  justificativa_obrigatoria: "Informe a justificativa para liberar o abastecimento.",
  expirado: "O prazo deste pedido de abastecimento já expirou — não dá mais para liberar.",
  ja_decidido: "Este abastecimento já foi decidido.",
  nao_pendente: "Este abastecimento não está mais aguardando decisão.",
  nao_autorizado: "Você não tem permissão para decidir este abastecimento.",
  nao_encontrado: "Abastecimento não encontrado.",
};

export async function decidirAbastecimentoNegadoAcao(
  id: number,
  decisao: "liberado" | "recusado",
  justificativa: string
): Promise<DecisaoResultado> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decidir_abastecimento_negado_pdv", {
    p_abastecimento_pdv_id: id,
    p_decisao: decisao,
    p_justificativa: justificativa.trim() || undefined,
  });
  if (error) return { ok: false, erro: "Não consegui registrar a decisão agora. Tente de novo." };
  const status = (data as { status?: string } | null)?.status ?? "";
  if (status !== "liberado" && status !== "recusado") {
    return { ok: false, erro: MENSAGENS[status] ?? "Não consegui registrar a decisão." };
  }
  revalidatePath("/abastecimentos-negados");
  return { ok: true };
}
