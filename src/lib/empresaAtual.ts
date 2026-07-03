import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type EmpresaOpcao = { id: string; nome: string };

// Resolve o usuário logado, seu perfil e a lista de empresas (clientes) que
// ele pode ver — mesma lógica usada em /postos. Quem só tem acesso a uma
// empresa nem precisa escolher; quem tem acesso a várias (ou é admin) vê um
// seletor. `empresaParam` normalmente vem de searchParams (?empresa=...).
export async function resolverEmpresaAtual(supabase: Supabase, empresaParam?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });

  // Fase 27.2 — achado real: um usuário vinculado a mais de uma empresa (ex.:
  // grupo econômico) caía na MESMA condição do admin e recebia a base de
  // clientes inteira sem filtro nenhum. RLS de "empresas" já bloqueava o
  // vazamento de dado (só retorna linhas de empresas_do_usuario), mas o
  // código não devia depender só disso — corrigido pra filtrar
  // explicitamente por minhasEmpresasIds, que já cobre o próprio cliente e
  // as empresas "irmãs" do mesmo grupo econômico.
  let empresas: EmpresaOpcao[] = [];
  if (perfil === "admin") {
    const { data } = await supabase.from("empresas").select("id, nome").order("nome");
    empresas = data ?? [];
  } else if (minhasEmpresasIds && minhasEmpresasIds.length > 0) {
    const { data } = await supabase.from("empresas").select("id, nome").in("id", minhasEmpresasIds).order("nome");
    empresas = data ?? [];
  }

  const empresaSelecionada =
    (empresaParam && empresas.some((e) => e.id === empresaParam) ? empresaParam : null) ??
    (empresas.length === 1 ? empresas[0].id : null);

  return {
    user,
    perfil: perfil as string | null,
    empresas,
    empresaSelecionada,
    nomeEmpresaSelecionada: empresas.find((e) => e.id === empresaSelecionada)?.nome,
  };
}
