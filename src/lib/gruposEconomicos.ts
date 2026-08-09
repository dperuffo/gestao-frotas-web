import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { exigirDocumentacaoAprovada } from "@/lib/empresasDocumentos";

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

// Fase 27.139 — pedido do Daniel: "Rede de Posto tem que estar na visão do
// posto para criação e gestão". Um posto revendedor (segmento='Revenda')
// que já é membro de uma Rede pode gerenciá-la (editar nome/CNPJ matriz,
// vincular/desvincular postos que ele mesmo controla) sem precisar de
// admin — mas só PARA REDES DAS QUAIS ELE JÁ FAZ PARTE (não pode mexer em
// rede de outro grupo econômico só por saber o id).
//
// Fase Grupo-Economico-Frota-Billing (09/08/2026) — pedido do Daniel:
// abrir o mesmo self-service pro Grupo Econômico de clientes (segmento=
// 'Frota'), que até aqui era 100% admin-only. Removida a restrição
// `grupo.segmento !== "Revenda"` — a checagem de "já é membro do grupo"
// abaixo já garante isolamento entre grupos independente do segmento,
// então basta aceitar os dois valores válidos da CHECK constraint.
async function ehAdminSuperusuarioOuMembroDaRede(
  supabase: ClienteSupabase,
  grupoId: string
): Promise<boolean> {
  if (await ehAdminOuSuperusuario(supabase)) return true;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
  if (!minhasEmpresasIds || minhasEmpresasIds.length === 0) return false;

  const { data: grupo } = await supabase.from("grupos_economicos").select("segmento").eq("id", grupoId).maybeSingle();
  if (!grupo) return false;

  const { data: vinculo } = await supabase
    .from("grupos_economicos_empresas")
    .select("id")
    .eq("grupo_economico_id", grupoId)
    .in("empresa_id", minhasEmpresasIds)
    .limit(1)
    .maybeSingle();
  return !!vinculo;
}

// A RLS de grupos_economicos/grupos_economicos_empresas já restringe
// escrita a admin/superusuário (with_check), mas o padrão do projeto é
// sempre validar de novo aqui — mensagem de erro melhor pro usuário, não
// depender só da RLS pra dar feedback (ver Fase 27.80).
//
// Usada por /grupo-economico (Frota, sempre admin) e, quando quem chama é
// admin, também por /rede-postos (criação administrativa de uma Rede sem
// vincular posto nenhum ainda). Self-service de posto usa
// criarRedePostoSelfService, abaixo.
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

// Fase 27.139 — criação de Rede de Postos pelo próprio posto (self-service).
// Implementada como RPC SECURITY DEFINER (criar_rede_posto_self_service) em
// vez de um INSERT direto via supabase-js: uma Rede recém-criada ainda não
// tem nenhum vínculo em grupos_economicos_empresas, e o supabase-js sempre
// pede a linha de volta (RETURNING) depois do INSERT — o Postgres aplica a
// policy de SELECT (que exige já pertencer ao grupo) também sobre a linha
// devolvida por um RETURNING, então a Rede acabada de criar sempre seria
// rejeitada com "new row violates row-level security policy" antes de ter
// o primeiro membro. A RPC resolve isso criando o grupo E o vínculo do
// posto fundador na mesma transação, como dono da função (sem passar pelo
// RETURNING problemático). Funciona tanto pro posto quanto pro admin (a
// RPC também aceita admin/superusuário) — por isso /rede-postos/novo usa
// sempre esta função, nunca mais cria uma Rede "órfã" sem posto nenhum.
export async function criarRedePostoSelfService(
  supabase: ClienteSupabase,
  params: { nome: string; cnpjMatriz: string | null; empresaId: string }
): Promise<{ id: string } | { erro: string }> {
  const nome = params.nome.trim();
  if (!nome) return { erro: "Nome é obrigatório." };
  if (!params.empresaId) return { erro: "Selecione o posto fundador da Rede." };

  // Fase 27.149 — pedido do Daniel: "Na criação de Redes de Postos ou Grupos
  // Economicos, esta documentação devera servir de base para autorização de
  // criação dos grupos" — o posto fundador precisa ter documentação
  // societária/cadastral aprovada pelo admin antes de criar a Rede. Mesmo
  // espírito do gate de assinatura obrigatória (Fase 27.125,
  // decidirNegociacao): checagem em código, antes de qualquer escrita.
  const erroDocumentacao = await exigirDocumentacaoAprovada(supabase, params.empresaId, "Criar uma Rede de Postos");
  if (erroDocumentacao) return { erro: erroDocumentacao };

  const { data, error } = await supabase.rpc("criar_rede_posto_self_service", {
    p_nome: nome,
    p_cnpj_matriz: params.cnpjMatriz,
    p_empresa_id: params.empresaId,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  const resultado = data as { ok: boolean; id?: string; erro?: string };
  if (!resultado.ok) return { erro: resultado.erro ?? "Não foi possível salvar." };
  return { id: resultado.id! };
}

// Fase Grupo-Economico-Frota-Billing (09/08/2026) — equivalente exato de
// criarRedePostoSelfService acima, pro segmento='Frota'. Resolve o mesmo
// pedido do Daniel: "matriz/filiais ou empresas distintas do mesmo grupo
// econômico... deveria ser permitido pela aplicação para cadastro e
// visualização como grupo econômico" — o próprio cliente cria o grupo
// (self-service, sem depender do admin) e vira a empresa_administradora_id
// automaticamente, mesma regra de "quem cria é quem paga" já usada na Rede
// de Postos.
export async function criarGrupoFrotaSelfService(
  supabase: ClienteSupabase,
  params: { nome: string; cnpjMatriz: string | null; empresaId: string }
): Promise<{ id: string } | { erro: string }> {
  const nome = params.nome.trim();
  if (!nome) return { erro: "Nome é obrigatório." };
  if (!params.empresaId) return { erro: "Selecione a empresa fundadora do grupo." };

  // Mesmo gate de documentação aprovada da Rede de Postos (Fase 27.149) —
  // pedido do Daniel: "documentação deverá ser solicitada para análise e
  // aprovação do admin" pra qualquer novo grupo/rede.
  const erroDocumentacao = await exigirDocumentacaoAprovada(supabase, params.empresaId, "Criar um Grupo Econômico");
  if (erroDocumentacao) return { erro: erroDocumentacao };

  const { data, error } = await supabase.rpc("criar_grupo_frota_self_service", {
    p_nome: nome,
    p_cnpj_matriz: params.cnpjMatriz,
    p_empresa_id: params.empresaId,
  });
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  const resultado = data as { ok: boolean; id?: string; erro?: string };
  if (!resultado.ok) return { erro: resultado.erro ?? "Não foi possível salvar." };
  return { id: resultado.id! };
}

export async function atualizarGrupoEconomico(
  supabase: ClienteSupabase,
  params: { id: string; nome: string; cnpjMatriz: string | null; ativo: boolean }
): Promise<{ erro?: string }> {
  const nome = params.nome.trim();
  if (!nome) return { erro: "Nome é obrigatório." };
  // Fase 27.139 — Grupo Econômico (Frota) continua admin-only; Rede de
  // Postos (Revenda) também aceita quem já é membro da própria Rede.
  if (!(await ehAdminSuperusuarioOuMembroDaRede(supabase, params.id))) {
    return { erro: "Você não tem permissão para editar este grupo." };
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
  // Fase 27.139 — Grupo Econômico (Frota) continua admin-only; Rede de
  // Postos (Revenda) também aceita quem já é membro da própria Rede (só
  // pode adicionar posto A UMA REDE DA QUAL JÁ FAZ PARTE — evita que um
  // posto se auto-vincule a uma Rede de outra empresa só por saber o id;
  // essa checagem de "já é membro" fica em código, não em RLS, porque uma
  // policy de INSERT em grupos_economicos_empresas que consulta a própria
  // tabela pra isso dá erro de recursão infinita no Postgres — ver
  // migração fase_27_139_fix_recursao_via_grupos_select).
  if (!(await ehAdminSuperusuarioOuMembroDaRede(supabase, params.grupoId))) {
    return { erro: "Você não tem permissão para vincular postos a esta Rede." };
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

  // Fase 27.149 — pedido do Daniel: "Sempre que um novo posto ou um cliente
  // é aderido e agrupado nos grupos, a documentação devera ser solicitada
  // para analise e aprovação do admin" — a empresa sendo adicionada precisa
  // ter documentação aprovada antes do vínculo. Único ponto de código por
  // onde TODO novo membro de um grupo (Rede de Postos self-service ou
  // Grupo Econômico admin) passa, então basta aqui.
  const erroDocumentacao = await exigirDocumentacaoAprovada(
    supabase,
    params.empresaId,
    "Vincular esta empresa a um grupo"
  );
  if (erroDocumentacao) return { erro: erroDocumentacao };

  const { error } = await supabase
    .from("grupos_economicos_empresas")
    .insert({ grupo_economico_id: params.grupoId, empresa_id: params.empresaId });
  if (error) return { erro: error.message };
  return {};
}

export async function desvincularEmpresaDoGrupo(
  supabase: ClienteSupabase,
  vinculoId: string,
  grupoId: string
): Promise<{ erro?: string }> {
  // Fase 27.139 — mesma regra de atualizarGrupoEconomico/vincularEmpresaAoGrupo.
  if (!(await ehAdminSuperusuarioOuMembroDaRede(supabase, grupoId))) {
    return { erro: "Você não tem permissão para remover vínculos desta Rede." };
  }
  const { error } = await supabase.from("grupos_economicos_empresas").delete().eq("id", vinculoId);
  if (error) return { erro: error.message };
  return {};
}
