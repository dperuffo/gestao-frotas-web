import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app. AjudaIcon saiu daqui: só era usado
// dentro do Indicador() local removido — IndicadorColorido já expõe
// ajudaChave por conta própria.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Truck, Coins, Gauge, AlertTriangle } from "lucide-react";
import { GraficoTco } from "./_components/GraficoTco";

const TAMANHO_PAGINA = 50;

type SearchParams = {
  empresa?: string;
  busca?: string;
  centroCusto?: string;
  ordenar?: string;
  pagina?: string;
  inicio?: string;
  fim?: string;
};

function paraISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function TcoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const {
    empresa: empresaParam,
    busca,
    centroCusto,
    ordenar = "custo_por_km_desc",
    pagina: paginaParam,
    inicio,
    fim,
  } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase TCO (29/07/2026) — período default de 90 dias: uma janela curta
  // como "mês atual" (padrão do DRE) tende a ficar sem km suficiente pra
  // calcular custo/km de forma estável; 90 dias dá uma amostra melhor sem
  // exigir configuração do usuário.
  const agora = new Date();
  const inicioDefault = new Date(agora);
  inicioDefault.setDate(inicioDefault.getDate() - 90);
  const dataInicio = inicio || paraISO(inicioDefault);
  const dataFim = fim || paraISO(agora);

  const pagina = Math.max(1, Number(paginaParam) || 1);
  const offset = (pagina - 1) * TAMANHO_PAGINA;

  const { data: centrosCusto } = empresaSelecionada
    ? await supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaSelecionada).order("nome")
    : { data: [] };

  const { data: resumo, error } = empresaSelecionada
    ? await supabase.rpc("tco_frota_resumo", {
        p_empresa_id: empresaSelecionada,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_centro_custo_id: centroCusto || null,
        p_busca: busca || null,
        p_ordenar: ordenar,
        p_limit: TAMANHO_PAGINA,
        p_offset: offset,
      })
    : { data: null, error: null };

  const veiculos = resumo ?? [];
  const total = veiculos[0]?.total_count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));

  const tcoTotalFrota = veiculos.reduce((soma, v) => soma + v.tco_total, 0);
  const veiculosComKm = veiculos.filter((v) => v.custo_por_km !== null);
  const custoPorKmMedio =
    veiculosComKm.length > 0 ? veiculosComKm.reduce((s, v) => s + (v.custo_por_km ?? 0), 0) / veiculosComKm.length : 0;
  const veiculosCompletos = veiculos.filter((v) => v.tco_completo).length;
  const veiculosSemAquisicao = veiculos.length - veiculosCompletos;

  function paginaHref(novaPagina: number) {
    const params = new URLSearchParams();
    if (empresaSelecionada) params.set("empresa", empresaSelecionada);
    if (busca) params.set("busca", busca);
    if (centroCusto) params.set("centroCusto", centroCusto);
    if (ordenar) params.set("ordenar", ordenar);
    params.set("inicio", dataInicio);
    params.set("fim", dataFim);
    params.set("pagina", String(novaPagina));
    return `/tco?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">TCO — Custo Total de Propriedade</h1>
        <p className="mt-1 text-sm text-slate-500">
          Custo completo por veículo no período (combustível, manutenção, multas, oficinas, custos fixos e
          depreciação), pra identificar quais veículos estão pesando mais no bolso e quando vale trocar.
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
          <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
          <input type="date" name="inicio" defaultValue={dataInicio} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="fim" defaultValue={dataFim} className="input text-sm" />
        </div>
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
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordenar por</label>
          <select name="ordenar" defaultValue={ordenar} className="input text-sm">
            <option value="custo_por_km_desc">Maior custo/km primeiro</option>
            <option value="custo_por_km_asc">Menor custo/km primeiro</option>
            <option value="tco_total_desc">Maior TCO total primeiro</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver o TCO da frota dele.
        </p>
      )}

      {empresaSelecionada && error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erro ao carregar: {error.message}</p>
      )}

      {empresaSelecionada && !error && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <IndicadorColorido cor="sky" icon={Truck} label="Veículos no período" valor={String(veiculos.length)} />
            <IndicadorColorido
              cor="violet"
              icon={Coins}
              label="TCO total da frota"
              valor={formatarMoeda(tcoTotalFrota)}
              ajudaChave="tco.total"
            />
            <IndicadorColorido
              cor="sky"
              icon={Gauge}
              label="Custo/km médio"
              valor={custoPorKmMedio > 0 ? `${formatarMoeda(custoPorKmMedio)}/km` : "—"}
              ajudaChave="tco.custo_por_km"
            />
            <IndicadorColorido
              cor="amber"
              icon={AlertTriangle}
              label="Sem dado de aquisição"
              valor={String(veiculosSemAquisicao)}
              ajudaChave="tco.completo"
            />
          </div>

          <GraficoTco veiculos={veiculos} />

          {veiculosSemAquisicao > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚠️ <strong>{veiculosSemAquisicao} veículo(s)</strong> sem valor de aquisição cadastrado — o TCO deles
              está sendo calculado sem depreciação (custo &quot;operacional&quot;). Complete o cadastro em{" "}
              <Link href="/veiculos" className="underline">
                Veículos
              </Link>{" "}
              pra ver o TCO completo.
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Marca / Modelo</th>
                  <th className="px-4 py-3">Centro de custo</th>
                  <th className="px-4 py-3">Km no período</th>
                  <th className="px-4 py-3">TCO total</th>
                  <th className="px-4 py-3">Custo/km</th>
                  <th className="px-4 py-3">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {veiculos.map((v) => (
                  <tr key={v.placa} className="transition-colors hover:bg-frota-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/tco/${v.placa}`} className="font-medium text-frota-600 hover:underline">
                        {v.placa}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{v.centro_custo_nome ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {v.km_periodo !== null ? `${Math.round(v.km_periodo).toLocaleString("pt-BR")} km` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-slate-900">
                      {formatarMoeda(v.tco_total)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {v.custo_por_km !== null ? `${formatarMoeda(v.custo_por_km)}/km` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        {v.tco_completo ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Completo</span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Operacional</span>
                        )}
                        {v.fonte_depreciacao === "fipe_curva_real" && (
                          <span
                            className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700"
                            title="Depreciação calculada a partir da curva real de valor FIPE do veículo"
                          >
                            Curva FIPE
                          </span>
                        )}
                      </div>
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
// destaque de "sem dado de aquisição" agora é a própria cor do card
// (cor="amber"), não mais uma variante condicional.
