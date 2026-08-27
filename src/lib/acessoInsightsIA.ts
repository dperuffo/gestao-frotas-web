import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Fase IA-e-Automacao (27/08/2026, pedido do Daniel: "esta funcionalidade só
// pode ser apresentada para os clientes com plano enterprise") — Insights
// Proativos de IA é a única tela do produto com esse tipo de gate (por
// PLANO da empresa, não por perfil do usuário — o sistema de permissões em
// src/lib/permissoes.ts é role-based e compartilhado entre empresas,
// deliberadamente não misturado com esta checagem). `acesso_insights_ia_liberado`
// é a exceção manual (empresas de teste/demo, editável só por admin em
// /clientes/[id] — mesmo padrão de bypass_limite_frota).
export function empresaTemAcessoInsightsIA(empresa: { plano: string; acesso_insights_ia_liberado: boolean }): boolean {
  return empresa.plano === "enterprise" || empresa.acesso_insights_ia_liberado === true;
}

// Resolve se o USUÁRIO logado deve enxergar a tela — "sim" se ele é admin
// (convenção de sempre: admin vê tudo) ou se PELO MENOS UMA das empresas
// que ele acessa (própria + irmãs de grupo econômico, via
// empresas_do_usuario) é elegível. Usado pra decidir se o item aparece no
// menu lateral e se a rota /insights-ia fica bloqueada — ver layout.tsx.
export async function usuarioTemAcessoInsightsIA(supabase: Supabase, email: string, ehAdmin: boolean): Promise<boolean> {
  if (ehAdmin) return true;
  if (!email) return false;

  const { data: idsEmpresas } = await supabase.rpc("empresas_do_usuario", { p_email: email });
  const ids = idsEmpresas ?? [];
  if (ids.length === 0) return false;

  const { data: empresas } = await supabase
    .from("empresas")
    .select("plano, acesso_insights_ia_liberado")
    .in("id", ids);

  return (empresas ?? []).some(empresaTemAcessoInsightsIA);
}
