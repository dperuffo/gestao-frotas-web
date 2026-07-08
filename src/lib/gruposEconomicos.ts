import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type ClienteSupabase = SupabaseClient<Database>;

// Fase 27.87 — pedido do Daniel: "Criar a mesma mecanica de grupo economico
// para postos, só que em postos deve ser denominado de 'Rede de Postos' e
// o nome que leva a Rede" + "agrupamento de postos na mesma Rede para
// visao pelos usarios cadastrados na Rede".
//
// Em vez de duplicar tabela/RLS/RPC, o Grupo Econômico (cliente) e a Rede
// de Postos (posto) são a MESMA mecânica sobre a MESMA tabela
// (grupos_economicos/grupos_economicos_empresas) — só o `segmento` muda
// ('Frota' vs 'Revenda', mesmos valores de empresas.segmento). A RPC
// empresas_do_usuario() (banco) já expande por grupos_economicos_empresas
// independente do segmento da empresa, então um usuário vinculado a UM
// posto de uma Rede já enxerga as empresas irmãs em qualquer tela que use
// resolverEmpresaAtual()/empresas_do_usuario() — vem de graça, sem precisar
// alterar RLS nem duplicar autorização.
//
// Esta lib centraliza a lógica de escrita (criar/editar grupo, vincular/
// desvincular empresa) usada pelos dois pares de Server Actions
// (/grupo-economico/actions.ts e /rede-postos/actions.ts) — cada um só
// fixa o `segmento` certo e cuida do revalidatePath/redirect da própria
// rota.
export type SegmentoGrupo = "Frota" | "Revenda";

async function ehAdminOuSuperusuario(supabase: ClienteSupabase): Promise<boolean> {
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return perfil === "admin" || user?.email === "d.peruffo@gmail.com";
}

// A RLS de grupos_economicos/grupos_economicos_empresas já restringe
// escrita a admin/superusuário (with_check), mas o padrão do projeto é
// sempre validar de novo aqui — mensagem de erro melhor pro usuário, não
// depender só da RLS pra dar feedback (ver Fase 27.80).
export async function criarGrupoEconomico(
  supabase: ClienteSupabase,
  params: { segmento: SegmentoGrupo; nome: string; cnpjMatriz: string | null }
): Promise<{ id: string } | { erro: string }> {
  const nome = params.nome.trim();
  if (!nome) return { erro: "Nome é obrigatório." };
  if (!(await ehAdminOuSuperusuario(supabase))) {
    return { erro: "Só o time administrativo (FNI) pode criar grupos." };
  }

  const { data, error } = await supabase
    .from("grupos_economicos")
    .insert({ nome, cnpj_matriz: params.cnpjMatriz, segmento: params.segmento })
    .select("id")
    .single();

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  return { id: data.id };
}

export async function atualizarGrupoEconomico(
  supabase: ClienteSupabase,
  params: { id: string; nome: string; cnpjMatriz: string | null; ativo: boolean }
): Promise<{ erro?: string }> {
  const nome = params.nome.trim();
  if (!nome) return { erro: "Nome é obrigatório." };
  if (!(await ehAdminOuSuperusuario(supabase))) {
    return { erro: "Só o time administrativo (FNI) pode editar grupos." };
  }

  const { error } = await supabase
    .from("grupos_economicos")
    .update({
      nome,
      cnpj_matriz: params.cnpjMatriz,
      ativo: params.ativo,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  return {};
}

export async function vincularEmpresaAoGrupo(
  supabase: ClienteSupabase,
  params: { grupoId: string; empresaId: string }
): Promise<{ erro?: string }> {
  if (!(await ehAdminOuSuperusuario(supabase))) {
    return { erro: "Só o time administrativo (FNI) pode vincular empresas." };
  }

  // Defesa extra: a empresa precisa ser do mesmo segmento do grupo — não
  // dá pra colocar um posto dentro de um Grupo Econômico de clientes, nem
  // uma empresa de frota dentro de uma Rede de Postos.
  const [{ data: grupo }, { data: empresa }] = await Promise.all([
    supabase.from("grupos_economicos").select("segmento").eq("id", params.grupoId).maybeSingle(),
    supabase.from("empresas").select("segmento").eq("id", params.empresaId).maybeSingle(),
  ]);
  if (!grupo || !empresa) return { erro: "Grupo ou empresa não encontrados." };
  if (grupo.segmento !== empresa.segmento) {
    return {
      erro:
        grupo.segmento === "Revenda"
          ? "Só é possível vincular postos revendedores a uma Rede de Postos."
          : "Só é possível vincular clientes (frota) a um Grupo Econômico.",
    };
  }

  const { error } = await supabase
    .from("grupos_economicos_empresas")
    .insert({ grupo_economico_id: params.grupoId, empresa_id: params.empresaId });
  if (error) return { erro: error.message };
  return {};
}

export async function desvincularEmpresaDoGrupo(
  supabase: ClienteSupabase,
  vinculoId: string
): Promise<{ erro?: string }> {
  if (!(await ehAdminOuSuperusuario(supabase))) {
    return { erro: "Só o time administrativo (FNI) pode remover vínculos." };
  }
  const { error } = await supabase.from("grupos_economicos_empresas").delete().eq("id", vinculoId);
  if (error) return { erro: error.message };
  return {};
}
