import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { EMPRESA_ID_GLOBAL } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { obterOuDefinir, invalidarPrefixo } from "@/lib/cache";

// Fase enforcement-permissoes (04/08/2026, pedido do Daniel: "as permissoes
// deveriam travar se estiverem desligadas, tanto na web quanto no PWA") —
// até aqui, /permissoes só editava a tabela `permissoes_perfil`; nada no app
// lia essas linhas pra esconder item de menu ou bloquear rota (achado
// registrado na fase anterior, "revisao-permissoes-landing-rodopar"). Este
// módulo é o ÚNICO lugar que decide isso pro lado web — usado por
// `(dashboard)/layout.tsx` tanto pra filtrar os itens de menu quanto pra
// redirecionar quem tenta acessar a URL direta de uma tela sem permissão.
//
// Limitação conhecida, deixada de propósito: o bloqueio de ROTA usa só o
// padrão GLOBAL (empresa_id = EMPRESA_ID_GLOBAL) — a customização POR
// EMPRESA que gestor_frota/analista/posto podem fazer em /permissoes
// continua funcionando (grava normalmente, aparece como "Personalizado"),
// mas só afeta o que ELES enxergam de novo pedido de permissão pros
// próprios colegas — não o bloqueio automático de rota, que fica só no
// padrão global definido pelo admin. Resolver isso exigiria saber qual
// empresa está "ativa" em toda navegação, dentro de um layout que não
// recebe searchParams — complexidade deixada pra uma fase futura, se algum
// dia for pedida.
//
// "colaborador" não tem NENHUMA linha nesta tabela (só admin/gestor_frota/
// analista/posto têm as 64 linhas cada — confirmado por SQL antes desta
// fase) — então hoje fica sempre liberado por padrão, igual qualquer outro
// perfil ficaria numa funcionalidade nunca cadastrada (ver `temAcesso`
// abaixo). Se um dia for necessário restringir colaborador de verdade, a
// matriz de /permissoes precisa ganhar linhas pra esse perfil primeiro —
// fora do escopo desta fase (só ligar o que já estava desligado, não
// inventar restrição nova).

export type MapaPermissoes = Map<string, boolean>;

// Cada chave é o href EXATO de um item de menu (web) — o match em
// `resolverFuncionalidadeDaRota` trata "/x" como cobrindo também
// "/x/qualquercoisa" (rotas dinâmicas tipo /fretes/[id] ou
// /postos/importar), mas NUNCA "/x-y" (evita "/postos" capturar por engano
// "/postos-duplicados", ou "/documentos" capturar "/documentos-empresas" —
// bug real que essa técnica evita, ver `resolverFuncionalidadeDaRota`).
//
// Rotas que NÃO aparecem aqui (ex.: /treinamento, /documentos, /meu-posto,
// /documentos-empresas, /postos-duplicados, /fidelidade,
// /administracao/central-conteudo) nunca tiveram uma "aba_" própria na
// matriz — ficam implicitamente liberadas pra todo mundo autenticado, exato
// mesmo comportamento de "sem linha cadastrada = liberado".
export const HREF_FUNCIONALIDADE: Record<string, string> = {
  "/dashboard": "aba_dashboard",
  "/assistente": "aba_assistente_ia",
  "/assinatura": "aba_minha_assinatura",
  "/avaliar": "aba_avaliar_plataforma",
  "/financeiro": "aba_financeiro",
  "/financeiro-posto": "aba_financeiro_posto",
  "/conciliacao-bancaria": "aba_conciliacao_bancaria",
  "/fiscal": "aba_fiscal",
  "/inteligencia-rede": "aba_inteligencia",
  "/lgpd": "aba_lgpd",
  "/clientes": "aba_clientes",
  "/grupo-economico": "aba_grupo_economico",
  "/usuarios": "aba_usuarios",
  "/minha-equipe": "aba_minha_equipe",
  "/motoristas": "aba_motoristas",
  "/veiculos": "aba_veiculos",
  "/cadastros-pendentes": "aba_cadastros_pendentes",
  "/duplicidade-placas-grupo": "aba_veiculos",
  "/centros-custo": "aba_centros_custo",
  "/postos": "aba_postos",
  // Fase Abastecimento-Interno (21/08/2026) — reaproveita a mesma
  // funcionalidade de "/postos" (mesmo tema — combustível/postos — já
  // liberada pra todo perfil relevante), evitando precisar semear uma linha
  // nova em permissoes_perfil pra cada empresa existente.
  "/postos-internos": "aba_postos",
  "/abastecimentos": "aba_abastecimentos",
  "/notas-fiscais": "aba_notas_fiscais",
  // Fase Central-Avisos-Por-Empresa (04/08/2026) — reaproveita a MESMA
  // funcionalidade já existente em permissoes_perfil (usada pra travar
  // /administracao/central-avisos pro admin); aqui é a versão pro
  // não-admin criar avisos só pra própria empresa (ver
  // central-avisos/gerenciar/page.tsx e criar_aviso_empresa() no banco).
  "/central-avisos/gerenciar": "aba_central_avisos",
  // Renomeada (Fase Ações-Sugeridas-Completa) — mesma linha antiga de
  // "Anomalias", que saiu do menu mas continua sendo o mesmo conceito.
  "/acoes-sugeridas": "aba_anomalias",
  "/fidelidade-motoristas": "aba_fidelidade_motoristas",
  "/parcerias-locais": "aba_parcerias_locais",
  "/roteirizacao": "aba_roteirizacao",
  "/rotograma": "aba_rotograma",
  "/planos-viagem": "aba_planos_viagem",
  "/fretes": "aba_fretes",
  "/torre-de-controle": "aba_torre_controle",
  "/programacao": "aba_programacao_frota",
  "/agendamentos-patio": "aba_agendamento_patio",
  "/cotacoes": "aba_cotacoes",
  "/tabelas-frete": "aba_tabelas_frete",
  "/crm-comercial": "aba_crm_comercial",
  "/faturas-fretes": "aba_faturas_fretes",
  "/motoristas-parceiros": "aba_motoristas_parceiros",
  "/negociacoes": "aba_negociacoes",
  "/precos-postos": "aba_precos_postos",
  "/conferencia-precos": "aba_conferencia_precos",
  "/combustivel-ideal": "aba_combustivel_ideal",
  "/manutencao-preditiva": "aba_manutencao",
  "/estoque-pecas": "aba_estoque_pecas",
  "/tco": "aba_tco",
  "/patrimonio": "aba_patrimonio",
  "/indicadores-frota": "aba_indicadores_frota",
  "/checklist-veiculos": "aba_checklist_veiculos",
  "/sinistros": "aba_sinistros",
  "/multas": "aba_multas",
  "/oficinas": "aba_oficinas",
  "/parametros-uso": "aba_parametros_uso",
  "/parametros-nf": "aba_parametros_nf",
  "/relatorios": "aba_relatorios",
  "/pegada-carbono": "aba_pegada_carbono",
  "/integracoes": "aba_api_integracoes",
  "/rede-postos": "aba_rede_postos",
  "/minha-empresa": "aba_meus_dados_pix",
  "/clientes-posto": "aba_clientes_posto",
  "/pre-pedidos": "aba_pre_pedidos",
  "/permissoes": "aba_permissoes",
  "/assinaturas": "aba_assinaturas_clientes",
  "/avaliacoes": "aba_avaliacoes_clientes",
  "/configuracoes": "aba_configuracoes_sistema",
  "/administracao/pisos-antt": "aba_pisos_antt",
  "/administracao/central-avisos": "aba_central_avisos",
  "/administracao/oficinas-credenciadas": "aba_oficinas_credenciadas",
  // Achado real (13/08/2026, auditoria da tela /permissoes) — estas duas
  // rotas existem e são acessíveis direto por URL, mas nunca tiveram uma
  // "aba_" própria na matriz: ficavam permanentemente liberadas pra
  // qualquer perfil, sem nenhum controle possível. Adicionadas aqui pra
  // ficarem bloqueáveis daqui pra frente — mas só passam a aparecer de
  // fato na tela de Permissões depois que existir ao menos 1 linha em
  // permissoes_perfil pra cada uma (a UI só lista funcionalidades que já
  // têm linha cadastrada, ver funcionalidades = Array.from(matriz.keys())
  // em permissoes/page.tsx). Ver README/handoff pro SQL de inserção.
  "/antifraude": "aba_antifraude",
  "/apuracao-tributaria": "aba_apuracao_tributaria",
  // Fase Permissoes-Novas-Features (27/08/2026, pedido do Daniel: "atualizar
  // a aba permissões com as novas features implementadas") — as 6 telas da
  // fase "Gestão e Controles" + "Novas Features de Produto" (27/08/2026)
  // nunca tinham "aba_" própria; ficavam permanentemente liberadas. Ver
  // migration permissoes_novas_features pro seed das linhas em
  // permissoes_perfil (padrão: liberado pra admin/gestor_frota/analista/
  // colaborador, bloqueado pra posto — exceto Log de Auditoria, exclusiva
  // do time interno).
  "/aprovacoes": "aba_aprovacoes",
  "/central-regras": "aba_central_regras",
  "/apolices-seguro": "aba_apolices_seguro",
  "/pneus": "aba_pneus",
  "/bolsa-fretes": "aba_bolsa_fretes",
  "/log-auditoria": "aba_log_auditoria",
  // Fase IA-e-Automacao (27/08/2026) — "Insights Proativos de IA"
  // (/insights-ia), 5º e último pilar do roadmap. Mesmo padrão de seed em
  // permissoes_perfil das linhas acima (migration permissoes_insights_ia).
  "/insights-ia": "aba_insights_ia",
};

// Rotas que NUNCA são bloqueadas por permissão, mesmo que a matriz diga
// "desligado" pra elas — proteção contra loop de redirecionamento
// (`/dashboard` é o próprio destino do redirect de bloqueio) e contra travar
// quem precisa da tela pra sair de qualquer bloqueio (`/chamados`,
// `/assinatura`, `/mfa-setup`) — mesmo espírito das exceções já existentes
// em `src/lib/supabase/middleware.ts` pro bloqueio de assinatura suspensa.
const ROTAS_NUNCA_BLOQUEADAS = new Set(["/dashboard", "/chamados", "/assinatura", "/mfa-setup", "/login"]);

export function resolverFuncionalidadeDaRota(pathname: string): string | null {
  if (ROTAS_NUNCA_BLOQUEADAS.has(pathname)) return null;

  let melhor: { href: string; funcionalidade: string } | null = null;
  for (const [href, funcionalidade] of Object.entries(HREF_FUNCIONALIDADE)) {
    const bate = pathname === href || pathname.startsWith(`${href}/`);
    if (bate && (!melhor || href.length > melhor.href.length)) {
      melhor = { href, funcionalidade };
    }
  }
  return melhor?.funcionalidade ?? null;
}

// Time interno (admin ou o e-mail do Daniel) nunca é bloqueado por
// permissão — mesmo espírito de "ehTimeInterno" já usado no middleware pro
// bloqueio de assinatura suspensa (src/lib/supabase/middleware.ts). Evita
// também que um admin se tranque fora do próprio sistema ao desligar a
// própria linha por engano na matriz.
export function ehBypassPermissao(perfil: string | null | undefined, email: string | null | undefined): boolean {
  return perfil === "admin" || email === "d.peruffo@gmail.com";
}

// Carrega o padrão GLOBAL de permissões (empresa_id = EMPRESA_ID_GLOBAL) pro
// perfil informado — usado tanto pra filtrar o menu quanto pra decidir se
// bloqueia a rota atual. Uma linha ausente = liberado (ver nota no topo do
// arquivo sobre "colaborador" e sobre funcionalidades nunca cadastradas).
// Falha de rede/banco não bloqueia (fail-open) — mesmo espírito "best
// effort" já usado em `src/lib/limitePlano.ts` (uma falha aqui não deve
// derrubar o dashboard inteiro, só deixa de aplicar o filtro desta vez).
// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "o cache deve
// ter hit/miss tracking") — esta função roda em TODA navegação autenticada
// (usada por (dashboard)/layout.tsx pra filtrar menu e checar acesso à
// rota), sempre pro mesmo pequeno conjunto de perfis (admin, gestor_frota,
// analista, posto, colaborador) — é o alvo mais óbvio da aplicação pra um
// primeiro cache: poucas chaves possíveis, lidas o tempo todo, escritas
// raramente (só quando alguém mexe em /permissoes). TTL de 30s: rápido o
// bastante pra uma mudança em /permissoes valer sem precisar reiniciar
// nada, e já reaproveitado por `invalidarCachePermissoes()` logo abaixo pra
// não precisar nem esperar os 30s quando é o próprio Daniel quem mudou.
const PREFIXO_CACHE_PERMISSOES = "permissoes:global:";

export function invalidarCachePermissoes(): void {
  invalidarPrefixo(PREFIXO_CACHE_PERMISSOES);
}

export async function carregarMapaPermissoes(
  supabase: SupabaseClient<Database>,
  perfil: string
): Promise<MapaPermissoes> {
  return obterOuDefinir(`${PREFIXO_CACHE_PERMISSOES}${perfil}`, 30_000, async () => {
    const mapa: MapaPermissoes = new Map();
    const { data, error } = await supabase
      .from("permissoes_perfil")
      .select("funcionalidade, permitido")
      .eq("empresa_id", EMPRESA_ID_GLOBAL)
      .eq("perfil", perfil);

    if (error) {
      // Fase Observabilidade-Fundacao (14/08/2026) — migrado pro logger
      // estruturado como demonstração do padrão novo (ver src/lib/logger.ts).
      await logger.error("permissoes", "Falha ao carregar permissões (fail-open, ignorado)", error);
      return mapa;
    }
    for (const linha of data ?? []) mapa.set(linha.funcionalidade, linha.permitido ?? false);
    return mapa;
  });
}

export function temAcesso(mapa: MapaPermissoes, funcionalidade: string | null): boolean {
  if (!funcionalidade) return true; // rota sem "aba_" mapeada nunca foi restringível
  return mapa.get(funcionalidade) ?? true; // sem linha cadastrada = liberado
}
