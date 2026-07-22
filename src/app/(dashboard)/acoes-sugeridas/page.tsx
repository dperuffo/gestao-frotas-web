import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { BotaoDetectarAcoes } from "./_components/BotaoDetectarAcoes";
import { CardAcaoSugerida, type AcaoSugerida } from "./_components/CardAcaoSugerida";

const POR_PAGINA = 20;

const TIPO_LABEL: Record<string, string> = {
  cnh_vencida: "CNH vencida",
  posto_acima_media: "Posto acima da média",
  hodometro_fora_padrao: "Hodômetro fora do padrão",
  volume_tanque: "Volume acima do tanque",
  geo_distancia: "Postos distantes no mesmo dia",
  preco_regiao: "Preço fora da média regional",
  // Fase Antifraude→Ações-Sugeridas — migrado do tipo "localizacao_posto"
  // de Antifraude.
  posto_nao_autorizado: "Posto não autorizado",
};

// Fase Motor-de-Ação-Automática — pedido do Daniel após o benchmark com a
// TicketLog: "vamos começar a implementar as demandas de alta prioridade".
// Central de Ações Sugeridas: o equivalente ao TED da TicketLog. Detecta
// oportunidades (reaproveitando Anomalias/Inteligência de Rede/CNH vencida,
// que já existiam só como alerta) e fecha o ciclo com aprovação explícita do
// gestor -> execução real no banco (bloquear motorista, remover posto da
// rede, cadastrar regra de hodômetro). Mesmo padrão de tela/filtro de
// Cliente que /anomalias já usa.
export default async function AcoesSugeridasPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; status?: string; empresa?: string; page?: string; busca?: string }>;
}) {
  const { tipo, status, empresa: empresaParam, page: pageParam, busca } = await searchParams;
  const buscaLimpa = busca?.trim() || undefined;
  const supabase = await createClient();

  const { perfil, empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(
    supabase,
    empresaParam
  );
  const ehAdmin = perfil === "admin";
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  const statusAtual = status ?? "pendentes";

  function comFiltros(builder: any) {
    let query = builder;
    if (empresaSelecionada) query = query.eq("empresa_id", empresaSelecionada);
    if (tipo) query = query.eq("tipo", tipo);
    if (statusAtual === "pendentes") query = query.eq("status", "pendente");
    if (statusAtual === "decididas") query = query.neq("status", "pendente");
    // Pedido do Daniel: com listas grandes (600+ pendências), fica difícil
    // achar uma ação pontual de um posto específico — busca por nome no
    // alvo (posto, placa ou motorista, dependendo do tipo da ação).
    if (buscaLimpa) query = query.ilike("alvo_label", `%${buscaLimpa}%`);
    return query;
  }

  const offset = offsetDaPagina(POR_PAGINA, pageParam);

  const queryContagem = comFiltros(
    supabase.from("acoes_sugeridas").select("id", { count: "exact", head: true })
  );
  const queryPagina = comFiltros(
    supabase
      .from("acoes_sugeridas")
      .select("id, tipo, alvo_tipo, alvo_label, titulo, descricao, severidade, status, decidido_em, decidido_por, erro_execucao, criado_em")
  )
    .order("severidade", { ascending: true })
    .order("criado_em", { ascending: false })
    .range(offset, offset + POR_PAGINA - 1);

  // KPIs (pendentes por severidade) — sempre da empresa selecionada (ou de
  // todas, se admin sem cliente escolhido), independente do filtro de
  // status/tipo da lista abaixo.
  const queryKpis = (() => {
    let q = supabase.from("acoes_sugeridas").select("severidade").eq("status", "pendente");
    if (empresaSelecionada) q = q.eq("empresa_id", empresaSelecionada);
    return q;
  })();

  const [{ count }, { data: linhasRaw, error }, { data: kpisRaw }] = semClienteEscolhido
    ? [{ count: 0 }, { data: [], error: null }, { data: [] }]
    : await Promise.all([queryContagem, queryPagina, queryKpis]);

  const totalRegistros = count ?? 0;
  const linhas = (linhasRaw ?? []) as AcaoSugerida[];
  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, POR_PAGINA, pageParam);

  const kpis = kpisRaw ?? [];
  const totalPendentes = kpis.length;
  const totalCriticas = kpis.filter((k) => k.severidade === "critica").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ações Sugeridas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Oportunidades detectadas automaticamente — CNH vencida, posto acima da média regional, hodômetro fora do
            padrão, volume acima do tanque, postos distantes no mesmo dia e preço fora da média regional. Aprovar
            executa a ação de verdade no sistema (bloquear motorista, remover posto da rede, cadastrar
            regra){nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/acoes-sugeridas/restricoes${empresaSelecionada ? `?empresa=${empresaSelecionada}` : ""}`}
            className="btn-secondary text-sm"
          >
            ⚙️ Restrições automáticas
          </Link>
          {!semClienteEscolhido && (
            <BotaoDetectarAcoes empresaId={empresaSelecionada} todasEmpresas={ehAdmin && !empresaSelecionada} />
          )}
        </div>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">{ehAdmin ? "Todos os clientes" : "Selecione um cliente..."}</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {semClienteEscolhido && !ehAdmin && (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver as ações sugeridas dele.</p>
      )}

      {!(semClienteEscolhido && !ehAdmin) && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador label="Pendentes" valor={String(totalPendentes)} />
            <Indicador label="Críticas (pendentes)" valor={String(totalCriticas)} destaque={totalCriticas > 0} />
            <Indicador label="Nesta página" valor={String(linhas.length)} />
          </div>

          <form className="mb-4 flex flex-wrap gap-3">
            <input type="hidden" name="empresa" value={empresaParam ?? ""} />
            <input
              type="text"
              name="busca"
              defaultValue={busca ?? ""}
              placeholder="Buscar por posto, placa ou motorista..."
              className="input text-sm sm:w-72"
            />
            <select name="tipo" defaultValue={tipo ?? ""} className="input text-sm">
              <option value="">Todos os tipos</option>
              {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={statusAtual} className="input text-sm">
              <option value="pendentes">Pendentes</option>
              <option value="decididas">Decididas</option>
              <option value="todas">Todas</option>
            </select>
            <button type="submit" className="btn-secondary text-sm">
              Filtrar
            </button>
          </form>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Erro ao carregar ações sugeridas: {error.message}
            </p>
          )}

          <div className="space-y-3">
            {linhas.map((acao) => (
              <CardAcaoSugerida key={acao.id} acao={acao} />
            ))}
            {linhas.length === 0 && !error && (
              <div className="card p-8 text-center text-sm text-slate-400">
                Nenhuma ação sugerida encontrada com esses filtros. Clique em &quot;Detectar oportunidades&quot; para
                analisar CNH, postos e hodômetro.
              </div>
            )}
          </div>

          <div className="mt-4">
            <Paginacao
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              totalRegistros={totalRegistros}
              porPagina={POR_PAGINA}
              basePath="/acoes-sugeridas"
              paramsAtuais={{ tipo, status: statusAtual, empresa: empresaParam, busca }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Indicador({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${destaque ? "text-red-600" : "text-slate-900"}`}>{valor}</p>
    </div>
  );
}
