import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type ClienteSupabase = SupabaseClient<Database>;

export const LOGOUT_INATIVIDADE_MINUTOS_PADRAO = 30;
export const LOGOUT_INATIVIDADE_MINUTOS_MIN = 5;
export const LOGOUT_INATIVIDADE_MINUTOS_MAX = 480;

// Fase 27.86 — pedido do Daniel: "Implementar logout automatico por um
// período de inatividade do usuario no sistema. Parametrizavel em tela de
// configuração do admin". O parâmetro é GLOBAL — vale pra todo o sistema
// (todos os perfis: admin, gestor_frota, analista, posto), não por
// cliente/posto — por isso a tabela `configuracoes_sistema` é um singleton
// (sempre 1 linha só). Qualquer usuário autenticado pode LER o valor (o
// monitor de inatividade roda no layout pra qualquer perfil); só admin
// edita.
export async function buscarLogoutInatividadeMinutos(supabase: ClienteSupabase): Promise<number> {
  const { data, error } = await supabase
    .from("configuracoes_sistema")
    .select("logout_inatividade_minutos")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    console.error("[configuracoesSistema] falha ao buscar timeout de inatividade (usando padrão):", error);
    return LOGOUT_INATIVIDADE_MINUTOS_PADRAO;
  }
  return data.logout_inatividade_minutos;
}

export function validarLogoutInatividadeMinutos(minutos: number): string | undefined {
  if (!Number.isInteger(minutos)) {
    return "O tempo precisa ser um número inteiro de minutos.";
  }
  if (minutos < LOGOUT_INATIVIDADE_MINUTOS_MIN || minutos > LOGOUT_INATIVIDADE_MINUTOS_MAX) {
    return `O tempo precisa estar entre ${LOGOUT_INATIVIDADE_MINUTOS_MIN} e ${LOGOUT_INATIVIDADE_MINUTOS_MAX} minutos.`;
  }
  return undefined;
}

// Guarda de autorização manual (mesmo padrão de atualizarCicloPagamento,
// Fase 27.80): a policy de UPDATE já restringe a admin/superusuário no
// banco, mas o padrão do projeto é sempre validar de novo aqui — mensagem
// de erro melhor pro usuário, e não depender só da RLS.
export async function atualizarLogoutInatividadeMinutos(
  supabase: ClienteSupabase,
  params: { minutos: number; atualizadoPor: string | null }
): Promise<{ ok: true } | { erro: string }> {
  const erroValidacao = validarLogoutInatividadeMinutos(params.minutos);
  if (erroValidacao) return { erro: erroValidacao };

  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ehSuperusuario = user?.email === "d.peruffo@gmail.com";
  if (perfil !== "admin" && !ehSuperusuario) {
    return { erro: "Só o time administrativo (FNI) pode ajustar essa configuração." };
  }

  const { error } = await supabase
    .from("configuracoes_sistema")
    .update({
      logout_inatividade_minutos: params.minutos,
      atualizado_em: new Date().toISOString(),
      atualizado_por: params.atualizadoPor,
    })
    .eq("id", true);

  if (error) return { erro: error.message };
  return { ok: true };
}
