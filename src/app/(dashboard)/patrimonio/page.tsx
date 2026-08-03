import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";

// Fase Grupo 2 (Rodopar/Datapar, item 6, 03/08/2026) — Patrimônio formal:
// depreciação contábil (linha reta pela vida útil) e correções do ativo,
// complementando o TCO já existente (que usa depreciação ECONÔMICA via
// curva FIPE só pra custo/km). Lista todos os veículos ativos da frota com
// valor de aquisição, depreciação acumulada e valor contábil líquido.

type SearchParams = { empresa?: string; busca?: string; ordenar?: string };

export default async function PatrimonioPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, busca, ordenar = "" } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const { data: resumo, error } = empresaSelecionada
    ? await supabase.rpc("patrimonio_frota_resumo", {
        p_empresa_id: empresaSelecionada,
        p_busca: busca || null,
        p_ordenar: ordenar || null,
      })
    : { data: null, error: null };

  const veiculos = resumo ?? [];
  const comAquisicao = veiculos.filter((v) => v.patrimonio_completo);
  const semAquisicao = veiculos.length - comAquisicao.length;
  const valorAquisicaoTotal = comAquisicao.reduce((s, v) => s + (v.valor_aquisicao ?? 0), 0);
  const depreciacaoTotal = comAquisicao.reduce((s, v) => s + (v.depreciacao_acumulada ?? 0), 0);
  const valorContabilTotal = comAquisicao.reduce((s, v) => s + (v.valor_contabil_liquido ?? 0), 0);
  const vidaUtilEsgotada = comAquisicao.filter((v) => !v.baixado && (v.percentual_depreciado ?? 0) >= 100).length;
  const baixados = veiculos.filter((v) => v.baixado).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Patrimônio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registro formal de ativo imobilizado: valor de aquisição, depreciação contábil (linha reta pela vida
          útil) e correções (reavaliação, melhoria, baixa) — complementa o TCO, que usa depreciação econômica
          (curva FIPE) só pra custo/km.
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ordenar por</label>
          <select name="ordenar" defaultValue={ordenar} className="input text-sm">
            <option value="">Placa</option>
            <option value="valor_contabil_asc">Menor valor contábil primeiro</option>
            <option value="percentual_desc">Mais depreciado primeiro</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver o patrimônio da frota dele.
        </p>
      )}

      {empresaSelecionada && error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erro ao carregar: {error.message}</p>
      )}

      {empresaSelecionada && !error && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Indicador label="Veículos c/ aquisição" valor={String(comAquisicao.length)} />
            <Indicador label="Valor de aquisição total" valor={formatarMoeda(valorAquisicaoTotal)} />
            <Indicador label="Depreciação acumulada" valor={formatarMoeda(depreciacaoTotal)} />
            <Indicador label="Valor contábil líquido" valor={formatarMoeda(valorContabilTotal)} />
            <Indicador
              label="Vida útil esgotada"
              valor={String(vidaUtilEsgotada)}
              destaque={vidaUtilEsgotada > 0 ? "aviso" : undefined}
            />
          </div>

          {semAquisicao > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚠️ <strong>{semAquisicao} veículo(s)</strong> sem valor/data de aquisição cadastrado — não entram no
              Patrimônio. Complete o cadastro em{" "}
              <Link href="/veiculos" className="underline">
                Veículos
              </Link>
              .
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Placa</th>
                  <th className="px-4 py-3">Marca / Modelo</th>
                  <th className="px-4 py-3">Aquisição</th>
                  <th className="px-4 py-3">Depreciação acumulada</th>
                  <th className="px-4 py-3">Valor contábil líquido</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {veiculos.map((v) => (
                  <tr key={v.placa} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/patrimonio/${v.placa}?empresa=${empresaSelecionada}`}
                        className="font-medium text-frota-600 hover:underline"
                      >
                        {v.placa}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {v.valor_aquisicao !== null ? formatarMoeda(v.valor_aquisicao) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {v.depreciacao_acumulada !== null ? (
                        <>
                          {formatarMoeda(v.depreciacao_acumulada)}
                          {v.percentual_depreciado !== null && (
                            <span className="ml-1 text-xs text-slate-400">({v.percentual_depreciado}%)</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-slate-900">
                      {v.valor_contabil_liquido !== null ? formatarMoeda(v.valor_contabil_liquido) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {v.baixado ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Baixado</span>
                      ) : !v.patrimonio_completo ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Sem aquisição</span>
                      ) : (v.percentual_depreciado ?? 0) >= 100 ? (
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">Vida útil esgotada</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Em depreciação</span>
                      )}
                    </td>
                  </tr>
                ))}
                {veiculos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhum veículo encontrado para esse filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Indicador({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: "aviso";
}) {
  return (
    <div className={`card p-4 ${destaque === "aviso" ? "border-amber-200 bg-amber-50/50" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${destaque === "aviso" ? "text-amber-700" : "text-slate-900"}`}>
        {valor}
      </p>
    </div>
  );
}
