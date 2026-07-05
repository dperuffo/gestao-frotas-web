import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { BotaoDetectar } from "./_components/BotaoDetectar";
import { BotaoRevisar } from "./_components/BotaoRevisar";

const POR_PAGINA = 30;

const TIPO_LABEL: Record<string, string> = {
  volume_tanque: "Volume x tanque",
  geo_distancia: "Postos distantes",
  hodometro: "Hodômetro",
  preco_regiao: "Preço regional",
};

type Anomalia = {
  id: number;
  tipo: string;
  severidade: string;
  placa: string | null;
  motorista_nome: string | null;
  data_abastecimento: string | null;
  descricao: string;
  revisado_em: string | null;
  revisado_por: string | null;
  criado_em: string;
};

// Fase 27.46 — Detecção de anomalias em abastecimentos. Tela operacional
// (não é exclusiva de admin): cada cliente vê as anomalias da própria frota
// (RLS de anomalias_abastecimento já restringe isso), e o admin (time FNI)
// enxerga todas, com um seletor de cliente igual ao de Abastecimentos.
//
// As 4 regras (ver migration "anomalias_abastecimento"): volume acima do
// tanque do veículo, postos distantes no mesmo dia (velocidade impossível),
// hodômetro retrocedendo/parado, e preço muito fora da média regional (ANP).
// Rodar a detecção é uma ação manual ("Detectar agora") nesta primeira
// versão — automatizar via cron é um próximo passo natural.
export default async function AnomaliasPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; status?: string; empresa?: string; page?: string }>;
}) {
  const { tipo, status, empresa: empresaParam, page: pageParam } = await searchParams;
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
    if (statusAtual === "pendentes") query = query.is("revisado_em", null);
    if (statusAtual === "revisadas") query = query.not("revisado_em", "is", null);
    return query;
  }

  const offset = offsetDaPagina(POR_PAGINA, pageParam);

  const queryContagem = comFiltros(
    supabase.from("anomalias_abastecimento").select("id", { count: "exact", head: true })
  );
  const queryPagina = comFiltros(
    supabase
      .from("anomalias_abastecimento")
      .select("id, tipo, severidade, placa, motorista_nome, data_abastecimento, descricao, revisado_em, revisado_por, criado_em")
  )
    .order("criado_em", { ascending: false })
    .range(offset, offset + POR_PAGINA - 1);

  // KPIs (não revisadas por severidade) — sempre da empresa selecionada (ou
  // de todas, se admin sem cliente escolhido), independente do filtro de
  // status/tipo da tabela abaixo.
  const queryKpis = (() => {
    let q = supabase.from("anomalias_abastecimento").select("severidade").is("revisado_em", null);
    if (empresaSelecionada) q = q.eq("empresa_id", empresaSelecionada);
    return q;
  })();

  const [{ count }, { data: linhasRaw, error }, { data: kpisRaw }] = semClienteEscolhido
    ? [{ count: 0 }, { data: [], error: null }, { data: [] }]
    : await Promise.all([queryContagem, queryPagina, queryKpis]);

  const totalRegistros = count ?? 0;
  const linhas = (linhasRaw ?? []) as Anomalia[];
  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, POR_PAGINA, pageParam);

  const kpis = kpisRaw ?? [];
  const totalPendentes = kpis.length;
  const totalCriticas = kpis.filter((k) => k.severidade === "critica").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Anomalias em Abastecimentos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Achados automáticos de possível fraude ou erro de lançamento — volume acima do tanque,
            postos distantes no mesmo dia, hodômetro retrocedendo e preço fora da média regional
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        {!semClienteEscolhido && (
          <BotaoDetectar empresaId={empresaSelecionada} todasEmpresas={ehAdmin && !empresaSelecionada} />
        )}
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
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver as anomalias dele.</p>
      )}

      {!(semClienteEscolhido && !ehAdmin) && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador label="Não revisadas" valor={String(totalPendentes)} />
            <Indicador label="Críticas (não revisadas)" valor={String(totalCriticas)} destaque={totalCriticas > 0} />
            <Indicador label="Nesta página" valor={String(linhas.length)} />
          </div>

          <form className="mb-4 flex flex-wrap gap-3">
            <input type="hidden" name="empresa" value={empresaParam ?? ""} />
            <select name="tipo" defaultValue={tipo ?? ""} className="input text-sm">
              <option value="">Todos os tipos</option>
              {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={statusAtual} className="input text-sm">
              <option value="pendentes">Não revisadas</option>
              <option value="revisadas">Revisadas</option>
              <option value="todas">Todas</option>
            </select>
            <button type="submit" className="btn-secondary text-sm">
              Filtrar
            </button>
          </form>

          <div className="card overflow-x-auto">
            {error && <p className="p-4 text-sm text-red-600">Erro ao carregar anomalias: {error.message}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {a.data_abastecimento ? formatDate(a.data_abastecimento) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={a.severidade === "critica" ? "badge-inativo" : "badge-atencao"}>
                        {TIPO_LABEL[a.tipo] ?? a.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.placa ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{a.motorista_nome ?? "—"}</td>
                    <td className="px-4 py-3 max-w-md text-slate-600">{a.descricao}</td>
                    <td className="px-4 py-3">
                      {a.revisado_em ? (
                        <span className="badge-ativo">Revisado{a.revisado_por ? ` por ${a.revisado_por}` : ""}</span>
                      ) : (
                        <span className="badge-atencao">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <BotaoRevisar id={a.id} revisada={Boolean(a.revisado_em)} />
                    </td>
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma anomalia encontrada com esses filtros. Clique em &quot;Detectar agora&quot; para
                      analisar os abastecimentos mais recentes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-4">
              <Paginacao
                paginaAtual={paginaAtual}
                totalPaginas={totalPaginas}
                totalRegistros={totalRegistros}
                porPagina={POR_PAGINA}
                basePath="/anomalias"
                paramsAtuais={{ tipo, status: statusAtual, empresa: empresaParam }}
              />
            </div>
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
