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

export type EmpresaPropria = { id: string; nome: string; segmento: string | null; plano: string; max_usuarios: number | null };

// Fase Convite-Self-Service (26/07/2026) — resolve a(s) empresa(s) que o
// usuário logado DONO DE VERDADE (vínculo direto em usuarios_empresas),
// sem passar por empresas_do_usuario()/resolverEmpresaAtual acima. A
// diferença importa aqui: empresas_do_usuario expande pra empresas "irmãs"
// do mesmo grupo econômico (Rede de Postos), então um gestor_frota/posto
// que também enxerga empresas irmãs em outras telas cairia, sem essa
// função, na possibilidade de "convidar colega pra empresa da qual ele só
// é irmão de rede, não dono direto" — não é a intenção de /minha-equipe.
export async function resolverEmpresaPropria(supabase: Supabase, empresaParam?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vinculos } = await supabase
    .from("usuarios_empresas")
    .select("empresa_id, empresas!inner(id, nome, segmento, plano, max_usuarios)")
    .eq("user_email", user?.email ?? "")
    .eq("ativo", true);

  const empresas: EmpresaPropria[] = (vinculos ?? []).map((v) => {
    const e = v.empresas as unknown as EmpresaPropria;
    return { id: e.id, nome: e.nome, segmento: e.segmento, plano: e.plano, max_usuarios: e.max_usuarios };
  });

  const empresaSelecionada: EmpresaPropria | null =
    (empresaParam ? (empresas.find((e) => e.id === empresaParam) ?? null) : null) ??
    (empresas.length === 1 ? empresas[0] : null);

  return { user, empresas, empresaSelecionada };
}
