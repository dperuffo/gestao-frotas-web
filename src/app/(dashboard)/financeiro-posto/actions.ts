"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_DESPESA_POSTO, type TipoDespesaPosto } from "@/lib/financeiroPostos";

export type FinanceiroPostoFormState = { erro?: string; sucesso?: string } | undefined;

// Fatura (conta a receber) — o posto marca como paga quando o cliente
// quita; RLS já garante que só o dono da fatura (empresa_posto_id) chega
// até aqui.
export async function marcarFaturaPagaAcao(faturaId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("faturas_postos")
    .update({
      status: "paga",
      pago_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.email ?? null,
    })
    .eq("id", faturaId)
    .eq("status", "aberta");

  if (error) return { erro: error.message };
  revalidatePath("/financeiro-posto");
  return {};
}

export async function cancelarFaturaAcao(faturaId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("faturas_postos")
    .update({ status: "cancelada", atualizado_em: new Date().toISOString(), atualizado_por: user?.email ?? null })
    .eq("id", faturaId)
    .eq("status", "aberta");

  if (error) return { erro: error.message };
  revalidatePath("/financeiro-posto");
  return {};
}

// Despesa (conta a pagar) — lançamento manual, mesmo espírito de
// salvarCustoFixoAcao em /financeiro (Frota).
export async function lancarDespesaAcao(
  empresaPostoId: string,
  _prev: FinanceiroPostoFormState,
  formData: FormData
): Promise<FinanceiroPostoFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };
  if (!empresaPostoId) return { erro: "Empresa não identificada." };

  const tipo = String(formData.get("tipo") ?? "") as TipoDespesaPosto;
  const valor = Number(formData.get("valor"));
  const competencia = String(formData.get("competencia") ?? "").trim();
  const vencimento = String(formData.get("vencimento") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const recorrente = formData.get("recorrente") === "on";

  if (!TIPOS_DESPESA_POSTO.includes(tipo)) return { erro: "Tipo de despesa inválido." };
  if (!Number.isFinite(valor) || valor <= 0) return { erro: "Valor inválido." };
  if (!competencia) return { erro: "Informe a competência (mês da despesa)." };
  if (!vencimento) return { erro: "Informe o vencimento." };

  const { error } = await supabase.from("despesas_postos").insert({
    empresa_posto_id: empresaPostoId,
    tipo,
    valor,
    competencia,
    vencimento,
    descricao,
    recorrente,
    criado_por: user.email,
    atualizado_por: user.email,
  });

  if (error) return { erro: `Não foi possível lançar a despesa: ${error.message}` };

  revalidatePath("/financeiro-posto");
  return { sucesso: "Despesa lançada." };
}

export async function marcarDespesaPagaAcao(despesaId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("despesas_postos")
    .update({
      status: "paga",
      pago_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.email ?? null,
    })
    .eq("id", despesaId)
    .eq("status", "aberta");

  if (error) return { erro: error.message };
  revalidatePath("/financeiro-posto");
  return {};
}

export async function excluirDespesaAcao(despesaId: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("despesas_postos").delete().eq("id", despesaId);
  if (error) return { erro: error.message };
  revalidatePath("/financeiro-posto");
  return {};
}
