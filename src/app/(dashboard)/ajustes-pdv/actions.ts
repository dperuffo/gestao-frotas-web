"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// #100 (04/10/2026, pedido do Daniel) — pedido de ajuste de abastecimento PDV
// com aprovação da contraparte. Posto e cliente pedem; a outra parte decide.
// Toda a regra (quem pode, campos, recálculo, pontos) fica no banco; aqui é
// só a casca.
export type AjustePdv = {
  id: string;
  abastecimentoId: number;
  codigo: string | null;
  placa: string | null;
  status: "pendente" | "aprovado" | "recusado" | "cancelado";
  solicitanteLado: "posto" | "cliente";
  motivo: string;
  alteracoes: Record<string, unknown>;
  originais: Record<string, unknown>;
  aplicados: Record<string, unknown> | null;
  criadoPor: string;
  criadoEm: string;
  decididoPor: string | null;
  decididoEm: string | null;
  decisaoMotivo: string | null;
  clienteNome: string | null;
  postoNome: string | null;
  possoDecidir: boolean;
  possoCancelar: boolean;
};

const MENSAGENS: Record<string, string> = {
  motivo_obrigatorio: "Explique o motivo do ajuste.",
  sem_alteracao: "Altere pelo menos um campo.",
  ja_ha_pedido_pendente: "Já existe um pedido de ajuste pendente para este abastecimento.",
  nao_confirmado: "Só abastecimentos confirmados podem ser ajustados.",
  nao_encontrado: "Abastecimento não encontrado.",
  sem_permissao: "Você não tem permissão para esta ação.",
  campo_invalido: "Campo inválido.",
  ja_decidido: "Este pedido já foi decidido.",
};

function mensagem(status?: string) {
  return MENSAGENS[status ?? ""] ?? "Não foi possível concluir agora.";
}

// Pedidos pendentes que aguardam a decisão do usuário (ele é a contraparte de quem pediu).
// Alimenta a bolinha do menu e o aviso flutuante.
export async function contarAjustesPdvPendentesAcao(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("contar_ajustes_pdv_pendentes_para_mim");
  return (data as number | null) ?? 0;
}

export async function solicitarAjustePdvAcao(
  codigoAbastecimento: string,
  alteracoes: Record<string, string | number | null>,
  motivo: string
): Promise<{ erro?: string }> {
  const codigo = Number(codigoAbastecimento.replace(/\D/g, ""));
  if (!codigo || codigo < 4000000000) return { erro: "Informe o código do abastecimento (ex.: 4000000033)." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("solicitar_ajuste_pdv", {
    p_abastecimento_id: codigo - 4000000000,
    p_alteracoes: alteracoes,
    p_motivo: motivo,
  });
  const status = (data as { status?: string } | null)?.status;
  if (error || status !== "ok") return { erro: mensagem(status) };
  revalidatePath("/ajustes-pdv");
  return {};
}

export async function decidirAjustePdvAcao(id: string, aprovar: boolean, motivo?: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decidir_ajuste_pdv", { p_ajuste_id: id, p_aprovar: aprovar, p_motivo: motivo });
  const status = (data as { status?: string } | null)?.status;
  if (error || status !== "ok") return { erro: mensagem(status) };
  revalidatePath("/ajustes-pdv");
  return {};
}

export async function cancelarAjustePdvAcao(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancelar_ajuste_pdv", { p_ajuste_id: id });
  const status = (data as { status?: string } | null)?.status;
  if (error || status !== "ok") return { erro: mensagem(status) };
  revalidatePath("/ajustes-pdv");
  return {};
}
