import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { StatusBadge } from "./_components/StatusBadge";
import { ScoreBar } from "./_components/ScoreBar";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
// Fase Redesign-Telas-Densas (12/08/2026) — pedido do Daniel: mesmo toque
// visual do Dashboard/Veículos/Financeiro/Abastecimentos.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Truck, AlertTriangle, Bell, CheckCircle2, Gauge } from "lucide-react";

const TAMANHO_PAGINA = 50;

type SearchParams = {
  empresa?: string;
  busca?: string;
  centroCusto?: string;
  status?: string;
  ordenar?: string;
  pagina?: string;
};

export default async function ManutencaoPreditivaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const {
    empresa: empresaParam,
    busca,
    centroCusto,
    status,
    ordenar = "score",
    pagina: paginaParam,
  } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const pagina = Math.max(1, Number(paginaParam) || 1);
  const offset = (pagina - 1) * TAMANHO_PAGINA;

  const { data: centrosCusto } = empresaSelecionada
    ? await supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaSelecionada).order("nome")
    : { data: [] };

  // Achado real do Daniel (12/08/2026): esta tela tem um seletor "Cliente"
  // explícito — selecionar um cliente do grupo econômico deve mostrar só a
  // frota dele, não o grupo inteiro. manutencao_preditiva_base expande pro
  // grupo por padrão (p_somente_empresa default false); mesmo ajuste já
  // feito no card do dashboard (ver fase 05/08/2026 em dashboard/page.tsx),
  // agora replicado aqui.
  const { data: resumo, error } = empresaSelecionada
    ? await supabase.rpc("manutencao_preditiva_resumo", {
        p_empresa_id: empresaSelecionada,
        p_centro_custo_id: centroCusto || null,
        p_busca: busca || null,
        p_status: status || null,
        p_ordenar: ordenar,
        p_limit: TAMANHO_PAGINA,
        p_offset: offset,
        p_somente_empresa: true,
      })
    : { data: null, error: null };

  const veiculos = resumo ?? [];
  const total = veiculos[0]?.total_count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));

  // KPIs vêm de uma função dedicada (manutencao_preditiva_kpis), não
  // recalculando a lista inteira sem paginação — ela ignora o filtro de
  // status de propósito, pra mostrar a distribuição real mesmo quando o
  // usuário está filtrando só "Crítico" e a tabela abaixo está vazia.
  const { data: kpisRows } = empresaSelecionada
    ? await supabase.rpc("manutencao_preditiva_kpis", {
        p_empresa_id: empresaSelecionada,
        p_centro_custo_id: centroCusto || null,
        p_busca: busca || null,
        p_somente_empresa: true,
      })
    : { data: null };

  const kpis = kpisRows?.[0];
  const totalVeiculos = kpis?.total_veiculos ?? 0;
  const totalCriticos = kpis?.total_criticos ?? 0;
  const totalAlertas = kpis?.total_alertas ?? 0;
  const totalOk = kpis?.total_ok ?? 0;
  const scoreMedio = kpis?.score_medio ?? 0;

  function paginaHref(novaPagina: number) {
    const params = new URLSearchParams();
    if (empresaSelecionada) params.set("empresa", empresaSelecionada);
    if (busca) params.set("busca", busca);
    if (centroCusto) params.set("centroCusto", centroCusto);
    if (status) params.set("status", status);
    if (ordenar) params.set("ordenar", ordenar);
    params.set("pagina", String(novaPagina));
    return `/manutencao-preditiva?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Manutenção Preditiva</h1>
        <p className="mt-1 text-sm text-slate-500">
          Score de desgaste por veículo (óleo, pneus, filtros e outros 5 componentes), com base em km rodado,
          consumo e histórico real de manutenções.
        </p>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
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
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input
            type="search"
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Placa, marca ou modelo..."
            className="input text-sm"
          />
        </div>
        {(centrosCusto?.length ?? 0) > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Centro de custo</label>
            <select name="centroCusto" defaultValue={centroCusto ?? ""} className="input text-sm">
              <option value="">Todos</option>
              {centrosCusto!.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
          <select name="status" defaultValue={status ?? ""} className="input text-sm">
            <option value="">Todos</option>
            <option value="critico">🔴 Crítico</option>
            <option value="alerta">🟡 Alerta</option>
            <option value="ok">🟢 OK</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordenar por</label>
          <select name="ordenar" defaultValue={ordenar} className="input text-sm">
            <option value="score">Pior estado primeiro</option>
            <option value="km">Maior km</option>
            <option value="placa">Placa A→Z</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver a análise preditiva da frota dele.
        </p>
      )}

      {empresaSelecionada && error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erro ao carregar: {error.message}</p>
      )}

      {empresaSelecionada && !error && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <IndicadorColorido cor="sky" icon={Truck} label="Veículos" valor={String(totalVeiculos)} />
            <IndicadorColorido
              cor="red"
              icon={AlertTriangle}
              label="Críticos"
              valor={String(totalCriticos)}
              ajudaChave="manutencao.status"
            />
            <IndicadorColorido cor="amber" icon={Bell} label="Em alerta" valor={String(totalAlertas)} ajudaChave="manutencao.status" />
            <IndicadorColorido cor="green" icon={CheckCircle2} label="OK" valor={String(totalOk)} ajudaChave="manutencao.status" />
            <IndicadorColorido
              cor="violet"
              icon={Gauge}
              label="Score médio"
              valor={`${Math.round(scoreMedio)}/100`}
              ajudaChave="manutencao.proxima_prevista"
            />
          </div>

          {totalCriticos > 0 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              🚨 <strong>{totalCriticos} veículo(s) em estado crítico</strong> — pelo menos um componente vencido
              pelo km rodado. Priorize agendar manutenção para eles.
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Marca / Modelo</th>
                  <th className="px-4 py-3">Centro de custo</th>
                  <th className="px-4 py-3">Km atual</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {veiculos.map((v) => (
                  <tr key={v.placa} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/manutencao-preditiva/${v.placa}`}
                        className="font-medium text-frota-600 hover:underline"
                      >
                        {v.placa}
                      </Link>
                      {v.empresa_dona_nome && <span className="ml-2 text-xs text-slate-400">({v.empresa_dona_nome})</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.centro_custo_nome ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {v.km_atual > 0 ? `${Math.round(v.km_atual).toLocaleString("pt-BR")} km` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar score={v.score_geral} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {v.n_criticos > 0 && <span className="mr-2 text-red-600">{v.n_criticos} crítico(s)</span>}
                      {v.n_alertas > 0 && <span className="text-amber-600">{v.n_alertas} alerta(s)</span>}
                      {v.n_criticos === 0 && v.n_alertas === 0 && "—"}
                    </td>
                  </tr>
                ))}
                {veiculos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Nenhum veículo encontrado para esse filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                Página {pagina} de {totalPaginas} · {total} veículo(s)
              </span>
              <div className="flex gap-2">
                <Link
                  href={paginaHref(Math.max(1, pagina - 1))}
                  aria-disabled={pagina <= 1}
                  className={`btn-secondary ${pagina <= 1 ? "pointer-events-none opacity-40" : ""}`}
                >
                  ← Anterior
                </Link>
                <Link
                  href={paginaHref(Math.min(totalPaginas, pagina + 1))}
                  aria-disabled={pagina >= totalPaginas}
                  className={`btn-secondary ${pagina >= totalPaginas ? "pointer-events-none opacity-40" : ""}`}
                >
                  Próxima →
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas). O
// destaque de "críticos" agora é a própria cor do card (cor="red"), não
// mais uma variante condicional.
