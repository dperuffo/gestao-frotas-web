import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELO_ASSISTENTE } from "@/lib/assistenteIA";

// Consumo de IA por cliente: cada empresa usa a franquia mensal de tokens do seu plano
// (chave da FNI) OU a própria chave Anthropic (guardada no Vault; consumo é dela e não
// reduz a franquia). Com chave cadastrada, o cliente escolhe qual usar; se a franquia do mês
// acabar, passa à chave dele automaticamente. Sem empresa (admin FNI), é uso interno, sem franquia.
export type OrigemChave = "fni" | "cliente" | "interno";

export type PreparoAssistente =
  | { ok: true; origem: OrigemChave; chaveApi: string | null }
  | { ok: false; mensagem: string };

export type UsoMes = {
  /** Tokens do mês que contam na franquia do plano (feitos com a chave da FNI). */
  usado: number;
  /** Tokens do mês feitos com a chave própria do cliente (não contam na franquia). */
  usado_chave_propria?: number;
  franquia: number;
  plano: string | null;
  chave_propria: boolean;
  /** Escolha do cliente que tem chave própria: gastar a franquia do plano (enquanto houver saldo) ou a chave. */
  preferencia?: "franquia" | "chave";
  chave_ultimos4: string | null;
  chave_atualizada_em: string | null;
};

export function formatarTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return String(n);
}

// Decisão pura (testável): dado o uso do mês, pode perguntar?
export function decidirAcesso(
  uso: Pick<UsoMes, "usado" | "franquia" | "chave_propria"> & { preferencia?: "franquia" | "chave" }
): "chave_cliente" | "franquia_ok" | "franquia_esgotada" {
  const franquiaComSaldo = uso.franquia < 0 || uso.usado < uso.franquia; // -1 = ilimitada
  if (uso.chave_propria) {
    // Cliente com chave: usa a que escolheu; se escolheu a franquia e ela acabou, passa à chave sozinho.
    return uso.preferencia === "chave" || !franquiaComSaldo ? "chave_cliente" : "franquia_ok";
  }
  return franquiaComSaldo ? "franquia_ok" : "franquia_esgotada";
}

export async function prepararAssistente(
  supabase: SupabaseClient<Database>,
  empresaId: string | null
): Promise<PreparoAssistente> {
  if (!empresaId) return { ok: true, origem: "interno", chaveApi: null };

  const { data, error } = await supabase.rpc("assistente_uso_mes", { p_empresa_id: empresaId });
  if (error || !data) return { ok: true, origem: "fni", chaveApi: null }; // sem medição, não derruba o atendimento
  const uso = data as unknown as UsoMes;

  const decisao = decidirAcesso(uso);
  if (decisao === "chave_cliente") {
    try {
      const { data: chave } = await createAdminClient().rpc("obter_chave_assistente_servidor", { p_empresa_id: empresaId });
      if (typeof chave === "string" && chave) return { ok: true, origem: "cliente", chaveApi: chave };
    } catch {
      /* cai na mensagem abaixo */
    }
    return {
      ok: false,
      mensagem: "Não foi possível usar a chave de IA cadastrada pela sua empresa. Cadastre a chave novamente no painel de uso do Assistente.",
    };
  }
  if (decisao === "franquia_esgotada") {
    return {
      ok: false,
      mensagem: `A franquia de IA do mês acabou (${formatarTokens(uso.usado)} de ${formatarTokens(uso.franquia)} tokens usados no plano ${uso.plano ?? "atual"}). Ela renova no início do próximo mês. Para continuar agora, cadastre a chave de IA da sua empresa no painel de uso (acima do chat) ou fale com a FNI para ampliar o plano.`,
    };
  }
  return { ok: true, origem: "fni", chaveApi: null };
}

export async function registrarConsumoAssistente(
  supabase: SupabaseClient<Database>,
  empresaId: string | null,
  medidor: { entrada: number; saida: number },
  origem: OrigemChave
): Promise<void> {
  if (medidor.entrada + medidor.saida <= 0) return;
  try {
    await supabase.rpc("registrar_consumo_assistente", {
      p_empresa_id: empresaId as string,
      p_tokens_entrada: medidor.entrada,
      p_tokens_saida: medidor.saida,
      p_modelo: MODELO_ASSISTENTE,
      p_origem: origem,
    });
  } catch {
    /* medição é best-effort: nunca derruba a resposta ao usuário */
  }
}

export function mensagemErroChaveCliente(e: unknown): string | null {
  const status = (e as { status?: number } | null)?.status;
  if (status === 401 || status === 403) {
    return "A Anthropic recusou a chave de IA cadastrada pela sua empresa (inválida, revogada ou sem crédito). Atualize a chave no painel de uso do Assistente.";
  }
  if (status === 429) return "O limite da chave de IA da sua empresa foi atingido na Anthropic. Tente novamente em instantes.";
  return null;
}
