"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { UF_PARA_ESTADO_ANP } from "@/lib/constants";

// Total de municípios por UF (referência aproximada IBGE) — só usado pra
// calcular % de cobertura no comparativo, mesma ideia (e mesma limitação de
// ser uma referência fixa, não uma consulta ao IBGE) do Streamlit original.
const TOTAL_MUNICIPIOS_UF: Record<string, number> = {
  AC: 22, AL: 102, AP: 16, AM: 62, BA: 417, CE: 184, DF: 1, ES: 78, GO: 246,
  MA: 217, MT: 141, MS: 79, MG: 853, PA: 144, PB: 223, PR: 399, PE: 184,
  PI: 224, RJ: 92, RN: 167, RS: 497, RO: 52, RR: 15, SC: 295, SP: 645,
  SE: 75, TO: 139,
};

const REGIOES: Record<string, string[]> = {
  Norte: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};

const COR_A = "#0D47A1";
const COR_B = "#B71C1C";

type PrecoUf = { uf: string; combustivel: string; precoMedio: number; qtdPostos: number };
type DistribuidoraUf = { uf: string; distribuidora: string; total: number };

type MetricasGrupo = {
  nPostos: number;
  nMuns: number;
  nCoord: number;
  cobPct: number;
  mediaMun: number;
  nDistrib: number;
  top10Distrib: { distribuidora: string; total: number }[];
  precos: Map<string, number>;
};

export type PropsComparativo = {
  postosPorUf: Record<string, number>;
  municipiosPorUf: Record<string, number>;
  coordPorUf: Record<string, number>;
  distribuidorasPorUf: DistribuidoraUf[];
  precosPorUf: PrecoUf[];
  ufsDisponiveis: string[];
};

function nomeUf(uf: string) {
  return `${uf} — ${UF_PARA_ESTADO_ANP[uf] ?? uf}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function calcularMetricas(
  ufs: string[],
  postosPorUf: Record<string, number>,
  municipiosPorUf: Record<string, number>,
  coordPorUf: Record<string, number>,
  distribuidorasPorUf: DistribuidoraUf[],
  precosPorUf: PrecoUf[]
): MetricasGrupo {
  const nPostos = ufs.reduce((soma, uf) => soma + (postosPorUf[uf] ?? 0), 0);
  const nMuns = ufs.reduce((soma, uf) => soma + (municipiosPorUf[uf] ?? 0), 0);
  const nCoord = ufs.reduce((soma, uf) => soma + (coordPorUf[uf] ?? 0), 0);
  const totalMunsRef = ufs.reduce((soma, uf) => soma + (TOTAL_MUNICIPIOS_UF[uf] ?? 0), 0);
  const cobPct = totalMunsRef > 0 ? Math.round((nMuns / totalMunsRef) * 1000) / 10 : 0;
  const mediaMun = nMuns > 0 ? Math.round((nPostos / nMuns) * 10) / 10 : 0;

  const distribMap = new Map<string, number>();
  for (const d of distribuidorasPorUf) {
    if (!ufs.includes(d.uf)) continue;
    distribMap.set(d.distribuidora, (distribMap.get(d.distribuidora) ?? 0) + d.total);
  }
  const top10Distrib = Array.from(distribMap.entries())
    .map(([distribuidora, total]) => ({ distribuidora, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const precoMap = new Map<string, { soma: number; qtd: number }>();
  for (const p of precosPorUf) {
    if (!ufs.includes(p.uf)) continue;
    const atual = precoMap.get(p.combustivel) ?? { soma: 0, qtd: 0 };
    atual.soma += p.precoMedio * p.qtdPostos;
    atual.qtd += p.qtdPostos;
    precoMap.set(p.combustivel, atual);
  }
  const precos = new Map(
    Array.from(precoMap.entries()).map(([combustivel, v]) => [combustivel, v.qtd > 0 ? v.soma / v.qtd : 0])
  );

  return { nPostos, nMuns, nCoord, cobPct, mediaMun, nDistrib: distribMap.size, top10Distrib, precos };
}

export function ModoComparativo({
  postosPorUf,
  municipiosPorUf,
  coordPorUf,
  distribuidorasPorUf,
  precosPorUf,
  ufsDisponiveis,
}: PropsComparativo) {
  const [modo, setModo] = useState<"estados" | "regioes">("estados");
  const regioesDisp = Object.keys(REGIOES).sort();
  const [ladoA, setLadoA] = useState(modo === "estados" ? ufsDisponiveis[0] : regioesDisp[0]);
  const [ladoB, setLadoB] = useState(modo === "estados" ? (ufsDisponiveis[1] ?? ufsDisponiveis[0]) : regioesDisp[1]);

  function trocarModo(novo: "estados" | "regioes") {
    setModo(novo);
    setLadoA(novo === "estados" ? ufsDisponiveis[0] : regioesDisp[0]);
    setLadoB(novo === "estados" ? (ufsDisponiveis[1] ?? ufsDisponiveis[0]) : regioesDisp[1]);
  }

  const ufsA = useMemo(() => (modo === "estados" ? [ladoA] : REGIOES[ladoA] ?? []), [modo, ladoA]);
  const ufsB = useMemo(() => (modo === "estados" ? [ladoB] : REGIOES[ladoB] ?? []), [modo, ladoB]);
  const labelA = modo === "estados" ? nomeUf(ladoA) : ladoA;
  const labelB = modo === "estados" ? nomeUf(ladoB) : ladoB;

  const metricasA = useMemo(
    () => calcularMetricas(ufsA, postosPorUf, municipiosPorUf, coordPorUf, distribuidorasPorUf, precosPorUf),
    [ufsA, postosPorUf, municipiosPorUf, coordPorUf, distribuidorasPorUf, precosPorUf]
  );
  const metricasB = useMemo(
    () => calcularMetricas(ufsB, postosPorUf, municipiosPorUf, coordPorUf, distribuidorasPorUf, precosPorUf),
    [ufsB, postosPorUf, municipiosPorUf, coordPorUf, distribuidorasPorUf, precosPorUf]
  );

  const linhasKpi: { label: string; a: number; b: number; formato?: "pct" | "decimal" }[] = [
    { label: "Postos GF", a: metricasA.nPostos, b: metricasB.nPostos },
    { label: "Municípios GF", a: metricasA.nMuns, b: metricasB.nMuns },
    { label: "Cobertura (%)", a: metricasA.cobPct, b: metricasB.cobPct, formato: "pct" },
    { label: "Distribuidoras", a: metricasA.nDistrib, b: metricasB.nDistrib },
    { label: "Com Coordenadas", a: metricasA.nCoord, b: metricasB.nCoord },
    { label: "Média GF/Município", a: metricasA.mediaMun, b: metricasB.mediaMun, formato: "decimal" },
  ];

  const combustiveisComuns = Array.from(new Set([...metricasA.precos.keys(), ...metricasB.precos.keys()])).sort();
  const dadosPrecoGrafico = combustiveisComuns.map((c) => ({
    combustivel: c,
    [labelA]: metricasA.precos.get(c) ?? undefined,
    [labelB]: metricasB.precos.get(c) ?? undefined,
  }));

  const melhorCombustivelA = Array.from(metricasA.precos.entries()).sort((x, y) => x[1] - y[1])[0];
  const melhorCombustivelB = Array.from(metricasB.precos.entries()).sort((x, y) => x[1] - y[1])[0];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-600">Comparar por:</span>
        <button
          type="button"
          onClick={() => trocarModo("estados")}
          className={`rounded-full px-3 py-1 ${modo === "estados" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          🗺️ Estados
        </button>
        <button
          type="button"
          onClick={() => trocarModo("regioes")}
          className={`rounded-full px-3 py-1 ${modo === "regioes" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          🌎 Regiões
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Lado A</label>
          <select value={ladoA} onChange={(e) => setLadoA(e.target.value)} className="input">
            {(modo === "estados" ? ufsDisponiveis : regioesDisp).map((v) => (
              <option key={v} value={v}>
                {modo === "estados" ? nomeUf(v) : v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Lado B</label>
          <select value={ladoB} onChange={(e) => setLadoB(e.target.value)} className="input">
            {(modo === "estados" ? ufsDisponiveis : regioesDisp).map((v) => (
              <option key={v} value={v}>
                {modo === "estados" ? nomeUf(v) : v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <CardResumo cor={COR_A} label={labelA} metricas={metricasA} melhorCombustivel={melhorCombustivelA} />
        <CardResumo cor={COR_B} label={labelB} metricas={metricasB} melhorCombustivel={melhorCombustivelB} />
      </div>

      <div className="mb-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Métrica</th>
              <th className="py-2 pr-3" style={{ color: COR_A }}>
                {labelA}
              </th>
              <th className="py-2 pr-3" style={{ color: COR_B }}>
                {labelB}
              </th>
              <th className="py-2">Comparação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhasKpi.map((l) => {
              const vencedorA = l.a > l.b;
              const empate = l.a === l.b;
              return (
                <tr key={l.label}>
                  <td className="py-2 pr-3 text-slate-700">{l.label}</td>
                  <td className="py-2 pr-3 tabular-nums" style={{ color: COR_A }}>
                    {l.formato === "pct" ? `${l.a.toFixed(1)}%` : l.formato === "decimal" ? l.a.toFixed(1) : l.a}
                  </td>
                  <td className="py-2 pr-3 tabular-nums" style={{ color: COR_B }}>
                    {l.formato === "pct" ? `${l.b.toFixed(1)}%` : l.formato === "decimal" ? l.b.toFixed(1) : l.b}
                  </td>
                  <td className="py-2">
                    {empate ? (
                      <span className="text-slate-500">= empate</span>
                    ) : vencedorA ? (
                      <span style={{ color: "#2E7D32" }}>▲ {labelA}</span>
                    ) : (
                      <span style={{ color: "#2E7D32" }}>▲ {labelB}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {combustiveisComuns.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Preço médio por combustível</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosPrecoGrafico} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="combustivel" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Legend />
              <Bar dataKey={labelA} fill={COR_A} radius={[4, 4, 0, 0]} />
              <Bar dataKey={labelB} fill={COR_B} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Combustível</th>
                  <th className="py-2 pr-3">{labelA}</th>
                  <th className="py-2 pr-3">{labelB}</th>
                  <th className="py-2 pr-3">Δ R$/L (A−B)</th>
                  <th className="py-2 pr-3">Δ %</th>
                  <th className="py-2">Mais barato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combustiveisComuns
                  .filter((c) => metricasA.precos.has(c) && metricasB.precos.has(c))
                  .map((c) => {
                    const pa = metricasA.precos.get(c)!;
                    const pb = metricasB.precos.get(c)!;
                    const diff = pa - pb;
                    const diffPct = pb !== 0 ? (diff / pb) * 100 : 0;
                    return (
                      <tr key={c}>
                        <td className="py-2 pr-3 text-slate-700">{c}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(pa)}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(pb)}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-600">
                          {diff >= 0 ? "+" : ""}
                          {formatarMoeda(diff)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-slate-600">
                          {diffPct >= 0 ? "+" : ""}
                          {diffPct.toFixed(1)}%
                        </td>
                        <td className="py-2 text-slate-600">{diff < 0 ? labelA : diff > 0 ? labelB : "Igual"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Distribuidoras — Top 10 ({labelA})</h3>
          <GraficoDistribuidoras dados={metricasA.top10Distrib} cor={COR_A} />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Distribuidoras — Top 10 ({labelB})</h3>
          <GraficoDistribuidoras dados={metricasB.top10Distrib} cor={COR_B} />
        </div>
      </div>
    </div>
  );
}

function CardResumo({
  cor,
  label,
  metricas,
  melhorCombustivel,
}: {
  cor: string;
  label: string;
  metricas: MetricasGrupo;
  melhorCombustivel?: [string, number];
}) {
  return (
    <div className="rounded-lg border-2 p-4" style={{ borderColor: cor }}>
      <p className="mb-2 text-sm font-semibold" style={{ color: cor }}>
        {label}
      </p>
      <ul className="space-y-1 text-sm text-slate-700">
        <li>{metricas.nPostos} postos GF credenciados</li>
        <li>
          {metricas.nMuns} municípios atendidos ({metricas.cobPct.toFixed(1)}% de cobertura)
        </li>
        <li>{metricas.nDistrib} distribuidoras presentes</li>
        <li>{metricas.mediaMun.toFixed(1)} postos por município (média)</li>
        {melhorCombustivel && (
          <li>
            Combustível mais barato: <strong>{melhorCombustivel[0]}</strong> a {formatarMoeda(melhorCombustivel[1])}
          </li>
        )}
      </ul>
    </div>
  );
}

function GraficoDistribuidoras({ dados, cor }: { dados: { distribuidora: string; total: number }[]; cor: string }) {
  if (dados.length === 0) {
    return <p className="text-sm text-slate-400">Sem distribuidora cadastrada.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 28)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="distribuidora" width={110} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => `${v} postos`} />
        <Bar dataKey="total" fill={cor} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
