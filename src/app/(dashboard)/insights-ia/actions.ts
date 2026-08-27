"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase IA-e-Automacao (27/08/2026) — "Insights Proativos de IA" (Assistente
// FNI proativo). O conteúdo é gerado 1x/dia pelo cron
// (/api/cron/gerar-insights-ia + src/lib/insightsIA.ts) — esta tela só lê e
// deixa marcar como lido/dispensar, nunca gera nada na hora (custo de IA
// previsível, sem chamada por visita à tela).
export type InsightIA = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  recomendacao: string | null;
  severidade: string;
  valor_impacto_estimado: number | null;
  status: string;
  gerado_em: string;
};

export async function listarInsightsAcao(empresaId: string, incluirDispensados = false): Promise<InsightIA[]> {
  const supabase = await createClient();
  let query = supabase
    .from("insights_proativos_ia")
    .select("id, categoria, titulo, descricao, recomendacao, severidade, valor_impacto_estimado, status, gerado_em")
    .eq("empresa_id", empresaId)
    .order("gerado_em", { ascending: false });

  if (!incluirDispensados) {
    query = query.neq("status", "dispensado");
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function contarInsightsNovosAcao(empresaId?: string | null): Promise<number> {
  const supabase = await createClient();
  let query = supabase.from("insights_proativos_ia").select("id", { count: "exact", head: true }).eq("status", "novo");
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { count } = await query;
  return count ?? 0;
}

export async function marcarInsightLidoAcao(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_insight_lido", { p_id: id });
  if (error) return { erro: error.message };
  revalidatePath("/insights-ia");
  revalidatePath("/central-regras");
  return {};
}

export async function dispensarInsightAcao(id: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dispensar_insight", { p_id: id });
  if (error) return { erro: error.message };
  revalidatePath("/insights-ia");
  revalidatePath("/central-regras");
  return {};
}
