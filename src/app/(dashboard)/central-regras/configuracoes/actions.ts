"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ChaveRegraConfiguravel } from "@/lib/regrasConfiguraveis";

// Fase Motor-de-Regras-Unico (27/08/2026) — server actions finas, toda a
// validação de chave/valor/permissão mora nas RPCs SECURITY DEFINER (mesmo
// motivo de sempre nesta base de código).

export async function salvarConfiguracaoRegraAcao(
  empresaId: string,
  chave: ChaveRegraConfiguravel,
  valor: number
): Promise<{ erro?: string }> {
  if (!Number.isFinite(valor) || valor < 0) {
    return { erro: "Valor inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("salvar_configuracao_regra", {
    p_empresa_id: empresaId,
    p_chave: chave,
    p_valor: valor,
  });

  if (error) return { erro: error.message };

  revalidatePath("/central-regras/configuracoes");
  return {};
}

export async function restaurarConfiguracaoRegraPadraoAcao(
  empresaId: string,
  chave: ChaveRegraConfiguravel
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("restaurar_configuracao_regra_padrao", {
    p_empresa_id: empresaId,
    p_chave: chave,
  });

  if (error) return { erro: error.message };

  revalidatePath("/central-regras/configuracoes");
  return {};
}
