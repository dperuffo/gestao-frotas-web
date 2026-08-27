"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase OCR-Abastecimento-Externo (27/08/2026) — aprovação/rejeição pelo
// gestor dos lançamentos manuais do motorista (cupom fiscal fotografado +
// OCR, ver registrar_abastecimento_manual). Toda a validação de posse e
// transição de status mora na RPC (SECURITY DEFINER) — esta action só
// repassa a chamada e revalida as telas afetadas.
export async function aprovarRejeitarAbastecimentoManualAcao(
  id: number,
  aprovar: boolean,
  motivoRejeicao?: string
): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("aprovar_rejeitar_abastecimento_manual", {
    p_id: id,
    p_aprovar: aprovar,
    p_motivo_rejeicao: motivoRejeicao || null,
  });

  if (error) return { erro: error.message };

  const status = (data as { status?: string } | null)?.status;
  if (status === "nao_encontrado") return { erro: "Lançamento não encontrado." };
  if (status === "nao_e_lancamento_manual") return { erro: "Este registro não é um lançamento manual." };
  if (status === "ja_processado") return { erro: "Este lançamento já foi aprovado ou rejeitado por outra pessoa." };
  if (status === "motivo_obrigatorio") return { erro: "Informe o motivo da rejeição." };

  revalidatePath("/abastecimentos");
  revalidatePath("/abastecimentos/pendentes-aprovacao");
  revalidatePath("/financeiro");
  return {};
}

// Conta pendentes pra badge no menu/cabeçalho — mesmo espírito de
// contarInsightsNovosAcao (Fase Insights de IA).
export async function contarAbastecimentosManuaisPendentesAcao(empresaId: string | null): Promise<number> {
  if (!empresaId) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("abastecimentos_externos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("provedor", "manual")
    .eq("status", "pendente");
  return count ?? 0;
}
