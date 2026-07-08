import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Fase 27.84 — pedido do Daniel: os painéis financeiros só mostravam
// ciclos JÁ FECHADOS (faturas_postos, gerada pelo robô
// gerar_faturas_postos_robo() só quando periodo_fim < hoje) — o ciclo
// ATUAL, em andamento, nunca aparecia em nenhuma tela até fechar no dia
// seguinte. `ciclos_abertos_postos()` (RPC SECURITY DEFINER, mesma lógica
// de corte de período do robô) calcula esse ciclo em andamento, com os
// abastecimentos acumulados até hoje, pra cada negociação aceita visível
// ao usuário logado — reaproveitada nas 4 telas (financeiro-posto,
// financeiro do cliente, /clientes/[id] admin e /clientes-posto/[id]).
export type CicloAberto = Database["public"]["Functions"]["ciclos_abertos_postos"]["Returns"][number];

export async function buscarCiclosAbertos(
  supabase: SupabaseClient<Database>
): Promise<CicloAberto[]> {
  const { data, error } = await supabase.rpc("ciclos_abertos_postos");
  if (error) {
    console.error("[ciclosAbertos] falha ao buscar ciclos em andamento (ignorado):", error);
    return [];
  }
  return data ?? [];
}
