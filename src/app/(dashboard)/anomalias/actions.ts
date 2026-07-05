"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Fase 27.46 — Detecção de anomalias em abastecimentos. Roda as 4 regras
// (volume x tanque, postos distantes no mesmo dia, hodômetro
// retrocedendo/parado, preço fora da média regional — ver migration
// "anomalias_abastecimento") e devolve quantas anomalias NOVAS foram
// gravadas (idempotente: reexecutar não duplica achado já existente).
//
// p_empresa_id null só é aceito pra admin (a própria função SQL, security
// definer, já verifica isso de novo no banco — não confiamos só nesta
// checagem do lado do app).
export type ResultadoDeteccao = { erro?: string; inseridas?: number };

export async function executarDeteccaoAnomaliasAcao(empresaId: string | null): Promise<ResultadoDeteccao> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("detectar_anomalias_abastecimento", {
    p_empresa_id: empresaId,
  });

  if (error) {
    return { erro: `Não foi possível rodar a detecção: ${error.message}` };
  }

  revalidatePath("/anomalias");
  return { inseridas: data ?? 0 };
}

// Marca uma anomalia como revisada — mesmo padrão null=não visto já usado em
// tickets/avaliacoes/acessos_clientes, só que aqui é por item (o usuário
// decide um a um, não "marcar tudo" — cada anomalia merece um olhar).
export async function marcarAnomaliaRevisadaAcao(id: number): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("anomalias_abastecimento")
    .update({ revisado_em: new Date().toISOString(), revisado_por: user?.email ?? null })
    .eq("id", id);

  if (error) {
    return { erro: `Não foi possível marcar como revisado: ${error.message}` };
  }

  revalidatePath("/anomalias");
  return {};
}

// Desfaz a revisão (útil se marcou por engano). Mesma ideia simples, sem
// tela de confirmação — é uma ação de baixo risco e reversível.
export async function desfazerRevisaoAnomaliaAcao(id: number): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("anomalias_abastecimento")
    .update({ revisado_em: null, revisado_por: null })
    .eq("id", id);

  if (error) {
    return { erro: `Não foi possível desfazer: ${error.message}` };
  }

  revalidatePath("/anomalias");
  return {};
}

// Conta anomalias não revisadas — badge no menu lateral (mesmo padrão de
// contarChamadosNaoVistosAcao/contarAcessosClientesNaoVistosAcao). Não
// precisa filtrar por empresa nem checar perfil aqui: a RLS de
// anomalias_abastecimento já devolve só as linhas que o usuário logado pode
// ver (suas empresas, ou todas se for admin) — mesmo raciocínio de
// contarChamadosNaoVistosAcao.
export async function contarAnomaliasNaoRevisadasAcao(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("anomalias_abastecimento")
    .select("id", { count: "exact", head: true })
    .is("revisado_em", null);

  return count ?? 0;
}
