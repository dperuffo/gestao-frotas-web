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

  let empresas: EmpresaOpcao[] = [];
  if (perfil === "admin" || (minhasEmpresasIds?.length ?? 0) > 1) {
    const { data } = await supabase.from("empresas").select("id, nome").order("nome");
    empresas = data ?? [];
  } else if (minhasEmpresasIds && minhasEmpresasIds.length === 1) {
    const { data } = await supabase.from("empresas").select("id, nome").eq("id", minhasEmpresasIds[0]).maybeSingle();
    empresas = data ? [data] : [];
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
