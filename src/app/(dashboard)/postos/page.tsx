import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { normalizarCNPJ } from "@/lib/utils";
import { UFS, ANP_PRECO_REFERENCIA_FALLBACK, PRODUTO_PARA_CATEGORIA_ANP } from "@/lib/constants";
import { AcaoPosto } from "./_components/AcaoPosto";
import { AbasPainel } from "../inteligencia-rede/_components/AbasPainel";
import { GraficoCustoAnp, type ItemCustoAnp } from "../inteligencia-rede/_components/GraficoCustoAnp";
import { GraficoAlertasPorEstado, type ItemAlertaEstado } from "../inteligencia-rede/_components/GraficoAlertasPorEstado";
import { TendenciaSazonalidade } from "../inteligencia-rede/_components/TendenciaSazonalidade";
import MapaDensidadeLazy from "../inteligencia-rede/_components/MapaDensidadeLazy";
import { ScoreFrota } from "./_components/ScoreFrota";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

const TAMANHO_PAGINA = 50;

type SearchParams = {
  q?: string;
  uf?: string;
  somenteAtivos?: string;
  pagina?: string;
  empresa?: string;
  visao?: string;
};

export default async function PostosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, uf, somenteAtivos, pagina: paginaTexto, empresa: empresaParam, visao: visaoParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });

  // Quem pode ver mais de um cliente (admin, ou usuário vinculado a várias
  // empresas) escolhe o cliente pelo seletor; quem só tem um, usa direto.
  // Fase 27.2 — achado real: um usuário vinculado a mais de uma empresa (ex.:
  // grupo econômico) caía na MESMA condição do admin e recebia a base de
  // clientes inteira sem filtro nenhum. RLS de "empresas" já bloqueava o
  // vazamento de dado (só retorna linhas de empresas_do_usuario), mas o
  // código não devia depender só disso — corrigido pra filtrar
  // explicitamente por minhasEmpresasIds, que já cobre o próprio cliente e
  // as empresas "irmãs" do mesmo grupo econômico.
  let empresas: { id: string; nome: string }[] = [];
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

  // Sem cliente selecionado não existe "rede" para mostrar — cai pro navegador do universo ANP.
  const visaoPedida = visaoParam === "universo" || visaoParam === "inteligencia" ? visaoParam : "rede";
  const visao: "rede" | "universo" | "inteligencia" = empresaSelecionada ? visaoPedida : "universo";
  const nomeEmpresaSelecionada = empresas.find((e) => e.id === empresaSelecionada)?.nome;

  const pagina = Math.max(1, Number(paginaTexto) || 1);
  const inicio = (pagina - 1) * TAMANHO_PAGINA;
  const fim = inicio + TAMANHO_PAGINA - 1;

  const paramsBase = { q, uf, somenteAtivos, empresa: empresaParam };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Postos Revendedores</h1>
          <p className="mt-1 text-sm text-slate-500">
            {visao === "rede"
              ? `Rede de postos negociada${nomeEmpresaSelecionada ? ` de ${nomeEmpresaSelecionada}` : ""} — clique num posto para ver detalhes, combustíveis e preços.`
              : "Universo nacional de postos ANP — use para localizar e ativar postos novos na rede do cliente."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/postos/importar-precos" className="btn-secondary">
            Importar preços
          </Link>
          {perfil === "admin" && (
            <Link href="/postos/importar-anp" className="btn-secondary">
              Atualizar universo ANP
            </Link>
          )}
          <Link href="/postos/importar" className="btn-primary">
            Importar planilha de postos
          </Link>
        </div>
      </div>

      {/* Fase 27.35 — achado real: cliente novo, ao ver "Rede do cliente"
          vazia (nenhum posto próprio cadastrado ainda), podia achar que
          precisava carregar postos antes de conseguir usar Roteirização/
          consultar preços — não é verdade, a aba "Explorar universo ANP"
          já cobre isso. Aviso informativo, só na visão "rede" (onde faz
          sentido, é onde o cliente ainda não tem nada carregado). */}
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="visao" value={visao} />
        {empresas.length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">UF</label>
          <select name="uf" defaultValue={uf ?? ""} className="input text-sm">
            <option value="">Todas</option>
            {UFS.map((sigla) => (
              <option key={sigla} value={sigla}>
                {sigla}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Razão social, município ou CNPJ..."
            className="input text-sm"
          />
        </div>
        {visao === "universo" && (
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="somenteAtivos" value="1" defaultChecked={somenteAtivos === "1"} />
            Só &quot;Gestão de Frotas&quot;
          </label>
        )}
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {visao === "rede" && (
        <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          💡 Ainda não carregou os postos do seu relacionamento? Sem problema: a Roteirização e a
          aba &quot;Explorar universo ANP&quot; já funcionam com a base pública de preços ANP.
          Carregar aqui a rede negociada é opcional e traz os preços realmente negociados com seus
          postos.
        </p>
      )}

      {empresaSelecionada && (
        <div className="mb-4 flex gap-2 border-b border-slate-200">
          <AbaLink params={paramsBase} visao="rede" ativo={visao === "rede"}>
            Rede do cliente
          </AbaLink>
          <AbaLink params={paramsBase} visao="universo" ativo={visao === "universo"}>
            Explorar universo ANP
          </AbaLink>
          <AbaLink params={paramsBase} visao="inteligencia" ativo={visao === "inteligencia"}>
            Inteligência da Minha Frota
          </AbaLink>
          <span className="flex items-center pl-1">
            <AjudaIcon
              chave={
                visao === "rede" ? "postos.rede_cliente" : visao === "universo" ? "postos.universo_anp" : "postos.minha_frota"
              }
            />
          </span>
        </div>
      )}

      {!empresaSelecionada && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente acima para ver a rede negociada dele. Sem um cliente selecionado só
          é possível explorar o universo ANP.
        </p>
      )}

      {visao === "rede" && empresaSelecionada ? (
        <ViewRede
          empresaId={empresaSelecionada}
          q={q}
          uf={uf}
          pagina={pagina}
          inicio={inicio}
          fim={fim}
          paramsBase={paramsBase}
        />
      ) : visao === "inteligencia" && empresaSelecionada ? (
        <ViewInteligencia empresaId={empresaSelecionada} />
      ) : (
        <ViewUniverso
          empresaSelecionada={empresaSelecionada}
          q={q}
          uf={uf}
          somenteAtivos={somenteAtivos}
          pagina={pagina}
          inicio={inicio}
          fim={fim}
          paramsBase={{ ...paramsBase, visao: "universo" }}
        />
      )}
    </div>
  );
}

// Visão principal do dia a dia: a rede já negociada do cliente (tabela
// postos_gf) — poucos milhares de linhas, todas com detalhe/combustíveis/
// preços disponíveis, ao contrário do universo ANP inteiro.
async function ViewRede({
  empresaId,
  q,
  uf,
  pagina,
  inicio,
  fim,
  paramsBase,
}: {
  empresaId: string;
  q?: string;
  uf?: string;
  pagina: number;
  inicio: number;
  fim: number;
  paramsBase: Record<string, string | undefined>;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("postos_gf")
    .select("cnpj, razao_social, municipio, uf, bandeira, ativo", { count: "exact" })
    .eq("empresa_id", empresaId)
    .order("razao_social")
    .range(inicio, fim);

  if (uf) query = query.eq("uf", uf);
  if (q) query = query.or(`razao_social.ilike.%${q}%,municipio.ilike.%${q}%,cnpj.ilike.%${q}%`);

  const [{ data: postos, count: totalFiltrado, error }, { count: totalRede }, { count: totalBloqueados }] =
    await Promise.all([
      query,
      supabase.from("postos_gf").select("cnpj", { count: "exact", head: true }).eq("empresa_id", empresaId),
      supabase
        .from("postos_gf")
        .select("cnpj", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("ativo", false),
    ]);

  const totalPaginas = Math.max(1, Math.ceil((totalFiltrado ?? 0) / TAMANHO_PAGINA));

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador label="Postos na rede" valor={totalRede ?? 0} />
        <Indicador label="Liberados para abastecimento" valor={(totalRede ?? 0) - (totalBloqueados ?? 0)} />
        <Indicador label="Bloqueados pelo gestor" valor={totalBloqueados ?? 0} />
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar postos: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Razão Social</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Município/UF</th>
              <th className="px-4 py-3">Bandeira</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {postos?.map((p) => (
              <tr key={p.cnpj} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/postos/${p.cnpj}`} className="font-medium text-frota-600 hover:underline">
                    {p.razao_social ?? p.cnpj}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.cnpj}</td>
                <td className="px-4 py-3 text-slate-600">{[p.municipio, p.uf].filter(Boolean).join("/") || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{p.bandeira ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.ativo ? (
                    <span className="badge-ativo">Ativo</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Bloqueado
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {postos?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum posto encontrado nessa rede. Importe a planilha ou ative postos no
                  universo ANP.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={totalFiltrado ?? 0} paramsBase={paramsBase} />
    </div>
  );
}

// Inteligência da Minha Frota — mesmos painéis da Inteligência de Rede
// (admin), mas escopados só pra rede do cliente selecionado. As RPCs
// aceitam p_empresa_id explícito (em vez de confiar só na RLS) porque um
// admin pode estar pré-visualizando a aba de um cliente específico, e a
// RLS dele enxerga a rede inteira — sem o filtro explícito ele veria todas
// as empresas misturadas em vez de só a do cliente selecionado.
async function ViewInteligencia({ empresaId }: { empresaId: string }) {
  const supabase = await createClient();

  const [
    { data: precoPorCombustivelRaw },
    { data: serieTendenciaRaw },
    { data: volatilidadeMensalRaw },
    { data: alertasRaw },
    { data: pontosMapaRaw },
    { data: desvioAnpRaw },
    { data: servicosPostoRaw },
  ] = await Promise.all([
    supabase.rpc("preco_medio_por_combustivel", { p_empresa_id: empresaId }),
    supabase.rpc("historico_precos_serie_uf_combustivel", { p_empresa_id: empresaId }),
    supabase.rpc("historico_precos_volatilidade_mensal", { p_empresa_id: empresaId }),
    supabase.rpc("postos_gf_alertas_preco", { p_threshold: 0.05, p_empresa_id: empresaId }),
    supabase.rpc("postos_gf_pontos_mapa", { p_empresa_id: empresaId }),
    supabase.rpc("postos_gf_desvio_anp", { p_empresa_id: empresaId }),
    supabase.rpc("postos_gf_servicos", { p_empresa_id: empresaId }),
  ]);

  // Referência oficial ANP (nível Brasil, semana mais recente importada) —
  // mesma lógica da Inteligência de Rede, pra saber se o comparativo usa
  // preço oficial ou a estimativa fixa de fallback.
  const { data: semanaMaisRecente } = await supabase
    .from("anp_precos_referencia")
    .select("data_inicial, data_final")
    .eq("nivel", "brasil")
    .order("data_final", { ascending: false })
    .limit(1)
    .maybeSingle();

  let referenciaOficialPorProduto = new Map<string, number>();
  if (semanaMaisRecente) {
    const { data: referenciaSemana } = await supabase
      .from("anp_precos_referencia")
      .select("produto, preco_medio")
      .eq("nivel", "brasil")
      .eq("data_final", semanaMaisRecente.data_final);
    referenciaOficialPorProduto = new Map(
      (referenciaSemana ?? []).filter((r) => r.preco_medio != null).map((r) => [r.produto, r.preco_medio as number])
    );
  }

  function resolverReferencia(combustivel: string): number | null {
    const categoriaAnp = PRODUTO_PARA_CATEGORIA_ANP[combustivel];
    const referenciaOficial = categoriaAnp ? referenciaOficialPorProduto.get(categoriaAnp) : undefined;
    return referenciaOficial ?? ANP_PRECO_REFERENCIA_FALLBACK[combustivel] ?? null;
  }

  const precoPorCombustivel: ItemCustoAnp[] = (precoPorCombustivelRaw ?? []).map((r) => {
    const referencia = resolverReferencia(r.combustivel);
    const categoriaAnp = PRODUTO_PARA_CATEGORIA_ANP[r.combustivel];
    const ehOficial = categoriaAnp ? referenciaOficialPorProduto.has(categoriaAnp) : false;
    return { combustivel: r.combustivel, precoMedio: r.preco_medio, referencia, ehOficial };
  });

  const serieTendencia = (serieTendenciaRaw ?? []).map((r) => ({
    mes: r.mes,
    uf: r.uf,
    combustivel: r.combustivel,
    precoMedio: r.preco_medio,
    qtd: r.qtd,
  }));
  const volatilidadeMensal = (volatilidadeMensalRaw ?? []).map((r) => ({
    mes: r.mes,
    combustivel: r.combustivel,
    volatilidade: r.volatilidade,
    qtd: r.qtd,
  }));

  const alertas = alertasRaw ?? [];
  const alertasPorEstadoMap = new Map<string, { postosAlerta: number; piorDesvio: number }>();
  for (const a of alertas) {
    if (!a.uf) continue;
    const atual = alertasPorEstadoMap.get(a.uf) ?? { postosAlerta: 0, piorDesvio: 0 };
    atual.postosAlerta += 1;
    atual.piorDesvio = Math.max(atual.piorDesvio, a.diff_pct);
    alertasPorEstadoMap.set(a.uf, atual);
  }
  const alertasPorEstado: ItemAlertaEstado[] = Array.from(alertasPorEstadoMap.entries())
    .map(([uf, v]) => ({ uf, ...v }))
    .sort((a, b) => b.postosAlerta - a.postosAlerta);
  const top20Alertas = alertas.slice(0, 20);

  const pontosMapa = (pontosMapaRaw ?? []).map((p) => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) }));

  const desvioAnp = (desvioAnpRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    municipio: r.municipio,
    uf: r.uf,
    combustivel: r.combustivel,
    diffPct: r.diff_pct,
  }));
  const servicosPosto = (servicosPostoRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    arla: r.arla,
    funciona24h: r.funciona_24h,
    possuiBanheiro: r.possui_banheiro,
    possuiEstacionamento: r.possui_estacionamento,
    possuiInternet: r.possui_internet,
    possuiOleoGranel: r.possui_oleo_granel,
    possuiRestaurante: r.possui_restaurante,
    possuiTrocaOleo: r.possui_troca_oleo,
    pistaCaminhao: r.pista_caminhao,
    conveniencia: r.conveniencia,
    convenienciaAmPm: r.conveniencia_am_pm,
  }));

  return (
    <AbasPainel
      abas={[
        {
          id: "precos",
          label: "⛽ Preços vs ANP",
          conteudo: (
            <>
              <div className="mb-6 card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Preço médio da sua rede vs referência ANP</h2>
                <p className="mb-3 text-xs text-slate-400">
                  {semanaMaisRecente
                    ? "Referência oficial ANP da semana mais recente importada. Combustíveis sem categoria oficial mapeada usam uma estimativa fixa."
                    : "Nenhuma planilha oficial da ANP foi importada ainda — usando estimativa fixa como referência provisória."}
                </p>
                <GraficoCustoAnp dados={precoPorCombustivel} />
              </div>
              <div className="card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">📅 Tendência de preço e sazonalidade por UF</h2>
                <p className="mb-3 text-xs text-slate-400">Calculado só sobre o histórico de preços da sua própria rede.</p>
                <TendenciaSazonalidade serie={serieTendencia} volatilidade={volatilidadeMensal} />
              </div>
            </>
          ),
        },
        {
          id: "alertas",
          label: "⚠️ Alertas de Preço",
          conteudo: (
            <div className="card p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Postos da sua rede com preço acima do ANP</h2>
              <p className="mb-4 text-xs text-slate-400">
                Postos com preço mais de 5% acima da referência ANP (município → estado → Brasil).
              </p>
              {alertasPorEstado.length > 0 ? (
                <div className="mb-6 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Postos em alerta por estado</h3>
                    <GraficoAlertasPorEstado dados={alertasPorEstado} />
                  </div>
                  <div className="overflow-x-auto">
                    <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Top 20 com maior desvio</h3>
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="py-2 pr-3">Posto</th>
                          <th className="py-2 pr-3">Combustível</th>
                          <th className="py-2">Desvio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {top20Alertas.map((a, i) => (
                          <tr key={`${a.cnpj}__${a.combustivel}__${i}`}>
                            <td className="py-2 pr-3 text-slate-700">{a.razao_social ?? "—"}</td>
                            <td className="py-2 pr-3 text-slate-600">{a.combustivel}</td>
                            <td className="py-2 font-medium text-red-600">+{a.diff_pct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Nenhum posto da sua rede em alerta no momento. 🎉</p>
              )}
            </div>
          ),
        },
        {
          id: "mapa",
          label: "🗺️ Mapa dos Meus Postos",
          conteudo: (
            <div className="card p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Distribuição geográfica da sua rede</h2>
              <p className="mb-3 text-xs text-slate-400">Só os postos vinculados à sua empresa.</p>
              <MapaDensidadeLazy pontos={pontosMapa} />
            </div>
          ),
        },
        {
          id: "score",
          label: "🏅 Score Operacional",
          conteudo: (
            <div className="card p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Score composto por posto</h2>
              <p className="mb-4 text-xs text-slate-400">
                Preço vs ANP (50%) + cobertura de serviços/infraestrutura (30%) + distância neutra (20%). Graus:
                A≥75, B≥55, C≥35, D&lt;35.
              </p>
              <ScoreFrota desvios={desvioAnp} servicos={servicosPosto} />
            </div>
          ),
        },
      ]}
    />
  );
}

// Navegador do universo ANP inteiro (35 mil+ postos) — usado para localizar
// e ativar postos que ainda não estão na rede negociada do cliente.
async function ViewUniverso({
  empresaSelecionada,
  q,
  uf,
  somenteAtivos,
  pagina,
  inicio,
  fim,
  paramsBase,
}: {
  empresaSelecionada: string | null;
  q?: string;
  uf?: string;
  somenteAtivos?: string;
  pagina: number;
  inicio: number;
  fim: number;
  paramsBase: Record<string, string | undefined>;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("anp_postos")
    .select("cnpj, razao_social, municipio, uf, gestao_frotas", { count: "exact" })
    .order("razao_social")
    .range(inicio, fim);

  if (uf) query = query.eq("uf", uf);
  if (somenteAtivos === "1") query = query.eq("gestao_frotas", true);
  if (q) query = query.or(`razao_social.ilike.%${q}%,municipio.ilike.%${q}%,cnpj.ilike.%${q}%`);

  const [{ data: postosAnp, count: totalFiltrado, error }, { count: totalGeral }, { count: totalGestaoFrotas }] =
    await Promise.all([
      query,
      supabase.from("anp_postos").select("id", { count: "exact", head: true }),
      supabase.from("anp_postos").select("id", { count: "exact", head: true }).eq("gestao_frotas", true),
    ]);

  const statusPorCnpj = new Map<string, boolean>();
  if (empresaSelecionada) {
    const { data: rede } = await supabase
      .from("postos_gf")
      .select("cnpj, ativo")
      .eq("empresa_id", empresaSelecionada);
    for (const r of rede ?? []) statusPorCnpj.set(normalizarCNPJ(r.cnpj), r.ativo);
  }

  const totalPaginas = Math.max(1, Math.ceil((totalFiltrado ?? 0) / TAMANHO_PAGINA));

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador label="Universo ANP (nacional)" valor={totalGeral ?? 0} />
        <Indicador label='Marcados "Gestão de Frotas"' valor={totalGestaoFrotas ?? 0} />
        <Indicador label="Ativos no cliente selecionado" valor={statusPorCnpj.size} />
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar postos: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Razão Social</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Município/UF</th>
              <th className="px-4 py-3">Gestão de Frotas</th>
              <th className="px-4 py-3">Status na rede do cliente</th>
              <th className="px-4 py-3">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {postosAnp?.map((p) => {
              const cnpjNormalizado = normalizarCNPJ(p.cnpj ?? "");
              const estaNaRede = statusPorCnpj.has(cnpjNormalizado);
              const ativo = statusPorCnpj.get(cnpjNormalizado) ?? true;
              return (
                <tr key={p.cnpj} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {estaNaRede ? (
                      <Link
                        href={`/postos/${cnpjNormalizado}`}
                        className="font-medium text-frota-600 hover:underline"
                      >
                        {p.razao_social ?? p.cnpj}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-700">{p.razao_social ?? p.cnpj}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.cnpj}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[p.municipio, p.uf].filter(Boolean).join("/") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.gestao_frotas ? "badge-ativo" : "badge-inativo"}>
                      {p.gestao_frotas ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!estaNaRede ? (
                      <span className="badge-inativo">Não cadastrado</span>
                    ) : ativo ? (
                      <span className="badge-ativo">Ativo</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Bloqueado pelo gestor
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AcaoPosto
                      cnpj={cnpjNormalizado}
                      empresaId={empresaSelecionada}
                      estaNaRede={estaNaRede}
                      ativo={ativo}
                    />
                  </td>
                </tr>
              );
            })}
            {postosAnp?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum posto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={totalFiltrado ?? 0} paramsBase={paramsBase} />
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function AbaLink({
  params,
  visao,
  ativo,
  children,
}: {
  params: Record<string, string | undefined>;
  visao: "rede" | "universo" | "inteligencia";
  ativo: boolean;
  children: React.ReactNode;
}) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
  usp.set("visao", visao);
  return (
    <Link
      href={`/postos?${usp.toString()}`}
      className={
        "border-b-2 px-3 py-2 text-sm font-medium " +
        (ativo ? "border-frota-600 text-frota-600" : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </Link>
  );
}

function Paginacao({
  pagina,
  totalPaginas,
  total,
  paramsBase,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  paramsBase: Record<string, string | undefined>;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>
        Página {pagina} de {totalPaginas} — {total} posto(s)
      </span>
      <div className="flex gap-2">
        <PaginaLink searchParams={paramsBase} pagina={pagina - 1} disabled={pagina <= 1}>
          ← Anterior
        </PaginaLink>
        <PaginaLink searchParams={paramsBase} pagina={pagina + 1} disabled={pagina >= totalPaginas}>
          Próxima →
        </PaginaLink>
      </div>
    </div>
  );
}

function PaginaLink({
  searchParams,
  pagina,
  disabled,
  children,
}: {
  searchParams: Record<string, string | undefined>;
  pagina: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="btn-secondary pointer-events-none opacity-40">{children}</span>;
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) params.set(k, v);
  }
  params.set("pagina", String(pagina));
  return (
    <Link href={`/postos?${params.toString()}`} className="btn-secondary">
      {children}
    </Link>
  );
}
