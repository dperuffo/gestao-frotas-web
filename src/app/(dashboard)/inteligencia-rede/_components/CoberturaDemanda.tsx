"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import MapaGapCoberturaLazy from "./MapaGapCoberturaLazy";
import type { PontoGap } from "./MapaGapCobertura";

const UF_CENTROIDES: Record<string, [number, number]> = {
  AC: [-9.0, -70.0], AL: [-9.6, -36.6], AP: [1.4, -51.8], AM: [-4.0, -63.0],
  BA: [-12.5, -41.7], CE: [-5.2, -39.3], DF: [-15.8, -47.9], ES: [-19.8, -40.5],
  GO: [-15.9, -49.6], MA: [-5.0, -45.3], MT: [-12.9, -55.8], MS: [-20.5, -54.6],
  MG: [-18.6, -44.5], PA: [-3.9, -52.5], PB: [-7.2, -36.5], PR: [-24.9, -51.5],
  PE: [-8.3, -37.9], PI: [-7.7, -42.7], RJ: [-22.3, -42.7], RN: [-5.8, -36.6],
  RS: [-30.0, -53.4], RO: [-10.9, -62.8], RR: [2.0, -61.4], SC: [-27.5, -50.5],
  SP: [-22.2, -48.6], SE: [-10.6, -37.4], TO: [-10.2, -48.3],
};

function corGap(gap: number) {
  if (gap >= 0.6) return "#E03030";
  if (gap >= 0.35) return "#F5A623";
  if (gap >= 0.15) return "#F5C518";
  return "#1A7A40";
}
function prioridade(gap: number) {
  if (gap >= 0.6) return "🔴 Crítico";
  if (gap >= 0.35) return "🟠 Alto";
  if (gap >= 0.15) return "🟡 Médio";
  return "🟢 Baixo";
}
function acaoSugerida(gap: number) {
  if (gap >= 0.6) return "Abrir posto urgente";
  if (gap >= 0.35) return "Avaliar nova unidade";
  if (gap >= 0.15) return "Monitorar crescimento";
  return "Cobertura adequada";
}
function formatarInt(v: number) {
  return v.toLocaleString("pt-BR");
}

// Cruza cobertura da rede GF (postos cadastrados por UF) com demanda real da
// frota (abastecimentos de verdade, de qualquer meio de pagamento integrado —
// Pró-Frotas, TicketLog, Rede Frota, Veloe, Valecard — não inclui rotas
// planejadas/sugeridas pelo otimizador da aplicação, que não são GPS real).
// Gap Score = demanda_normalizada × (1 − cobertura_normalizada).
export function CoberturaDemanda({ postosPorUf, demandaPorUf }: { postosPorUf: Record<string, number>; demandaPorUf: Record<string, number> }) {
  const linhas = useMemo(() => {
    const ufs = Object.keys(UF_CENTROIDES);
    const demandaMax = Math.max(1, ...ufs.map((uf) => demandaPorUf[uf] ?? 0));
    const coberturaMax = Math.max(1, ...ufs.map((uf) => postosPorUf[uf] ?? 0));
    return ufs
      .map((uf) => {
        const demanda = demandaPorUf[uf] ?? 0;
        const postosGf = postosPorUf[uf] ?? 0;
        const demandaNorm = demanda / demandaMax;
        const coberturaNorm = postosGf / coberturaMax;
        const gap = Math.round(demandaNorm * (1 - coberturaNorm) * 10000) / 10000;
        return { uf, demanda, postosGf, gap };
      })
      .sort((a, b) => b.gap - a.gap);
  }, [postosPorUf, demandaPorUf]);

  const demandaTotal = linhas.reduce((s, l) => s + l.demanda, 0);
  const nGapAlto = linhas.filter((l) => l.gap >= 0.35).length;
  const ufPrioritaria = linhas[0]?.uf ?? "—";
  const totalPostosGf = linhas.reduce((s, l) => s + l.postosGf, 0);

  const pontosMapa: PontoGap[] = linhas
    .filter((l) => l.demanda > 0)
    .map((l) => ({ uf: l.uf, demanda: l.demanda, postosGf: l.postosGf, gapScore: l.gap, cor: corGap(l.gap), lat: UF_CENTROIDES[l.uf][0], lon: UF_CENTROIDES[l.uf][1] }));

  const top15 = linhas.slice(0, 15);

  const criticos = linhas.filter((l) => l.gap >= 0.6).map((l) => l.uf);
  const altos = linhas.filter((l) => l.gap >= 0.35 && l.gap < 0.6).map((l) => l.uf);
  const semGf = linhas.filter((l) => l.postosGf === 0).map((l) => l.uf);

  const insights: string[] = [];
  if (criticos.length > 0) {
    insights.push(
      `🔴 Expansão urgente: as UFs ${criticos.slice(0, 5).join(", ")} têm alta demanda real e baixíssima cobertura GF — candidatas prioritárias para abertura imediata de novos postos.`
    );
  }
  if (altos.length > 0) {
    insights.push(
      `🟠 Avaliação estratégica: ${altos.slice(0, 4).join(", ")} têm gap relevante — vale avaliar parceiros/franquias locais para aumentar a presença GF.`
    );
  }
  if (semGf.length > 0) {
    insights.push(
      `⚠️ Sem nenhum posto GF: ${semGf.slice(0, 6).join(", ")} não têm cobertura GF cadastrada — mesmo com demanda baixa, a ausência total impede atendimento mínimo na região.`
    );
  }
  if (insights.length === 0) {
    insights.push("✅ Cobertura equilibrada: não foram identificados gaps críticos com os dados de abastecimento reais atuais.");
  }

  if (demandaTotal === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Ainda não há abastecimentos reais suficientes (de nenhum meio de pagamento integrado — GF) para medir demanda
        por UF. Sem esse histórico, o Gap Score ficaria só na cobertura, então preferimos não exibir números que
        pareçam mais confiáveis do que realmente são.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
        ⚠️ <strong>Demanda aqui = abastecimentos reais da frota</strong> (qualquer meio de pagamento integrado — GF:
        Pró-Frotas, TicketLog, Rede Frota, Veloe, Valecard), contados por UF do posto visitado. Não inclui rotas
        planejadas/sugeridas pelo otimizador da aplicação — essas são sugestões de roteirização, não GPS real, então
        foram deliberadamente deixadas de fora desse cálculo.
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi label="⛽ Abastecimentos analisados" valor={formatarInt(demandaTotal)} />
        <MiniKpi label="⚠️ UFs com gap alto/crítico" valor={formatarInt(nGapAlto)} />
        <MiniKpi label="🥇 UF prioritária" valor={ufPrioritaria} />
        <MiniKpi label="⛽ Total postos GF" valor={formatarInt(totalPostosGf)} />
      </div>

      <p className="mb-1 text-xs font-medium text-slate-600">🗺️ Mapa de Gaps — Demanda real vs Cobertura GF</p>
      <p className="mb-2 text-xs text-slate-400">Tamanho da bolha = demanda (abastecimentos reais). Cor = severidade do gap.</p>
      <MapaGapCoberturaLazy pontos={pontosMapa} />

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium text-slate-600">📊 Top 15 UFs — Prioridade de Expansão</p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={top15} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 1.1]} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => v.toFixed(3)} />
            <Bar dataKey="gap" name="Gap Score" radius={[4, 4, 0, 0]}>
              {top15.map((l) => (
                <Cell key={l.uf} fill={corGap(l.gap)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-1 text-xs text-slate-400">🔴 Crítico ≥0,60 · 🟠 Alto ≥0,35 · 🟡 Médio ≥0,15 · 🟢 Baixo &lt;0,15</p>
      </div>

      <div className="mt-6 space-y-2">
        {insights.map((texto, i) => (
          <div key={i} className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-slate-700">
            {texto}
          </div>
        ))}
      </div>

      <details className="mt-4 rounded-lg border border-slate-200">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700">ℹ️ Como o Gap Score é calculado</summary>
        <div className="space-y-1 px-4 pb-4 pt-0 text-xs text-slate-600">
          <p>
            <strong>Gap Score</strong> = demanda_normalizada × (1 − cobertura_normalizada)
          </p>
          <p>Demanda: quantidade de abastecimentos reais da frota (qualquer meio de pagamento integrado — GF) na UF do posto visitado.</p>
          <p>Cobertura: número de postos GF cadastrados na UF.</p>
          <p>Ambos normalizados pelo maior valor do conjunto (escala 0–1).</p>
          <p>Gap próximo de 1,0 = alta demanda real + quase nenhuma cobertura GF → prioridade máxima de expansão.</p>
        </div>
      </details>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">UF</th>
              <th className="py-2 pr-3">Demanda (abast. reais)</th>
              <th className="py-2 pr-3">Postos GF</th>
              <th className="py-2 pr-3">Gap Score</th>
              <th className="py-2 pr-3">Prioridade</th>
              <th className="py-2">Ação sugerida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.uf}>
                <td className="py-2 pr-3 text-slate-700">{l.uf}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{l.demanda}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{l.postosGf}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{l.gap.toFixed(3)}</td>
                <td className="py-2 pr-3">{prioridade(l.gap)}</td>
                <td className="py-2 text-slate-600">{acaoSugerida(l.gap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniKpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
