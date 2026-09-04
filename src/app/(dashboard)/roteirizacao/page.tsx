import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { UFS } from "@/lib/constants";
import { corPorBandeira } from "@/lib/coresBandeira";
import { formatCNPJ } from "@/lib/utils";
import { buscarPostosPorUfAcao } from "./actions";
import { AbasRoteirizacao } from "./_components/AbasRoteirizacao";
import { ScoreBadge } from "./_components/ScoreBadge";
import { PrecosChips } from "./_components/PrecosChips";
import MapaRotaLazy from "./_components/MapaRotaLazy";
import { GraficoRoteirizacao } from "./_components/GraficoRoteirizacao";
import { SalvarConsultaForm } from "./_components/SalvarConsultaForm";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { MapPin, Fuel } from "lucide-react";

type SearchParams = { empresa?: string; uf?: string; municipio?: string };

export default async function RoteirizacaoUfPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, uf, municipio } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const postos =
    empresaSelecionada && uf ? await buscarPostosPorUfAcao({ empresaId: empresaSelecionada, uf, municipio }) : [];

  const topPorCombustivel = new Map<string, typeof postos>();
  for (const posto of postos) {
    for (const p of posto.precos) {
      const lista = topPorCombustivel.get(p.combustivel) ?? [];
      lista.push(posto);
      topPorCombustivel.set(p.combustivel, lista);
    }
  }
  const ranking = Array.from(topPorCombustivel.entries()).map(([combustivel, lista]) => ({
    combustivel,
    top5: [...lista]
      .sort((a, b) => {
        const pa = a.precos.find((x) => x.combustivel === combustivel)?.preco ?? Infinity;
        const pb = b.precos.find((x) => x.combustivel === combustivel)?.preco ?? Infinity;
        return pa - pb;
      })
      .slice(0, 5),
  }));

  // Fase Plano-Graficos Onda 3 (04/09/2026) — distribuição por bandeira e
  // preço médio por combustível, a partir dos postos já carregados acima
  // (sem query nova).
  const porBandeiraMap = new Map<string, number>();
  for (const posto of postos) {
    const chave = posto.bandeira ?? "Sem bandeira";
    porBandeiraMap.set(chave, (porBandeiraMap.get(chave) ?? 0) + 1);
  }
  const porBandeira = Array.from(porBandeiraMap.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);

  const precoMedioPorCombustivel = Array.from(topPorCombustivel.entries())
    .map(([combustivel, lista]) => {
      const precos = lista
        .map((p) => p.precos.find((x) => x.combustivel === combustivel)?.preco)
        .filter((p): p is number => typeof p === "number");
      const media = precos.length > 0 ? precos.reduce((s, v) => s + v, 0) / precos.length : 0;
      return { combustivel, preco: media };
    })
    .sort((a, b) => a.preco - b.preco);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Roteirização</h1>
        <p className="mt-1 text-sm text-slate-500">
          Consulte a rede de postos, planeje rotas e paradas de abastecimento.
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
          <label className="mb-1 block text-xs font-medium text-slate-500">UF</label>
          <select name="uf" defaultValue={uf ?? ""} className="input text-sm">
            <option value="">Selecione...</option>
            {UFS.map((sigla) => (
              <option key={sigla} value={sigla}>
                {sigla}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Município</label>
          <input type="text" name="municipio" defaultValue={municipio ?? ""} placeholder="Opcional" className="input text-sm" />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {/* Fase 27.35 — achado real: cliente novo achava que precisava
          carregar a rede própria de postos ANTES de conseguir consultar
          rota/posto. Não é verdade — a consulta já funciona com a base
          pública de preços ANP por UF/município. Aviso informativo, sempre
          visível (não é um erro nem bloqueia nada).
          Fase 27.140 — a partir daqui o resultado sempre MESCLA os postos
          próprios (postos_gf) com a base pública ANP (coluna "Fonte" na
          tabela abaixo mostra de onde veio cada um). */}
      <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
        💡 Esta consulta já funciona com a base pública de preços ANP, mesmo sem nenhum posto
        próprio cadastrado — o resultado mistura os dois: postos próprios do cliente (preço
        negociado/importado) e a base pública nacional (estimativa oficial ANP). Carregar a rede
        negociada do cliente (em Postos Revendedores) é opcional e traz mais preços realmente
        negociados.
      </p>

      <AbasRoteirizacao ativo="uf" />

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para consultar a rede de postos dele.
        </p>
      )}

      {empresaSelecionada && !uf && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">Escolha uma UF para começar.</p>
      )}

      {empresaSelecionada && uf && postos.length === 0 && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Nenhum posto ativo com coordenadas encontrado para esse filtro.
        </p>
      )}

      {postos.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <IndicadorColorido cor="sky" icon={MapPin} label="Postos encontrados" valor={String(postos.length)} />
            <IndicadorColorido cor="green" icon={Fuel} label="Combustíveis com preço" valor={String(ranking.length)} />
          </div>

          <div className="mb-6">
            <MapaRotaLazy
              marcadores={postos.map((p) => ({
                lat: p.lat,
                lon: p.lon,
                label: p.razaoSocial ?? formatCNPJ(p.cnpj),
                cnpj: p.cnpj,
                cor: corPorBandeira(p.bandeira),
                legendaLabel: p.bandeira ?? "Sem bandeira",
              }))}
            />
          </div>

          <GraficoRoteirizacao porBandeira={porBandeira} precoMedioPorCombustivel={precoMedioPorCombustivel} />

          {ranking.length > 0 && (
            <div className="mb-6 card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Top 5 mais baratos por combustível</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ranking.map(({ combustivel, top5 }) => (
                  <div key={combustivel} className="rounded-lg border border-slate-100 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{combustivel}</p>
                    <ol className="space-y-1.5">
                      {top5.map((p, i) => (
                        <li key={p.cnpj} className="flex items-center gap-2 text-sm">
                          <span className="w-4 shrink-0 text-xs font-semibold text-slate-400">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-slate-700">
                            {p.razaoSocial ?? formatCNPJ(p.cnpj)}
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-status-ativo">
                            R$ {p.precos.find((x) => x.combustivel === combustivel)?.preco.toFixed(3)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-x-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Postos ({postos.length})</h2>
              <SalvarConsultaForm
                tipo="estado"
                empresaId={empresaSelecionada}
                dados={{ uf, municipio: municipio ?? "" }}
                nomeSugerido={`Postos em ${municipio ? `${municipio} - ` : ""}${uf}`}
              />
            </div>
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="whitespace-nowrap py-2 pr-4"><span className="inline-flex items-center gap-1">Score <AjudaIcon chave="roteirizacao.score_posto" /></span></th>
                  <th className="py-2 pr-4">Razão social</th>
                  <th className="whitespace-nowrap py-2 pr-4">Bandeira</th>
                  <th className="whitespace-nowrap py-2 pr-4">Município</th>
                  <th className="py-2 pr-4">Preços registrados</th>
                  <th className="whitespace-nowrap py-2">Fonte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {postos.map((p) => (
                  <tr key={p.cnpj} className="transition-colors hover:bg-frota-50/60">
                    <td className="py-2.5 pr-4 align-top">
                      <ScoreBadge score={p.score} />
                    </td>
                    <td className="py-2.5 pr-4 align-top text-slate-700">{p.razaoSocial ?? formatCNPJ(p.cnpj)}</td>
                    <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">{p.bandeira ?? "—"}</td>
                    <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">
                      {p.municipio ?? "—"} - {p.uf ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 align-top">
                      <PrecosChips precos={p.precos} />
                    </td>
                    <td className="py-2.5 align-top whitespace-nowrap">
                      {/* Fase 27.140 — transparência sobre a origem de cada
                          posto: "Próprio" veio de postos_gf do cliente
                          (preço negociado/importado); "Base ANP" veio da
                          base pública nacional (preço é a estimativa
                          oficial da ANP, não negociado). */}
                      {p.origem === "anp" ? (
                        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          Base ANP
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                          Próprio
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
