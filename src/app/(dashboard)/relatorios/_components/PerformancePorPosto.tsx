"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RegistroHistorico } from "./Anomalias";
import { formatarDataBr, formatarDataCurta } from "@/lib/utils";

function formatarMoeda(v: number, casas = 3) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// Score simplificado só de preço (sem serviços, ao contrário do score
// composto de Postos Revendedores) — aqui o interesse é ver a EVOLUÇÃO do
// preço ao longo do tempo, não uma foto do momento. score = 75 - desvio da
// média histórica do próprio posto, escalado.
function scorePrecoSimplificado(preco: number, mediaHistoricaPosto: number) {
  if (!mediaHistoricaPosto) return 50;
  const diff = (preco - mediaHistoricaPosto) / mediaHistoricaPosto;
  return Math.max(0, Math.min(100, 75 - diff * 200));
}

// Performance de um posto específico ao longo do tempo: evolução do score
// (aproximado por preço vs média histórica do próprio posto), competitividade
// vs média da rede por combustível e consistência (CV) — complementa o Score
// Operacional de Postos Revendedores, que é uma foto do momento, não um
// histórico.
export function PerformancePorPosto({ historico }: { historico: RegistroHistorico[] }) {
  const postos = useMemo(() => {
    const porCnpj = new Map<string, { cnpj: string; razaoSocial: string | null; uf: string | null }>();
    for (const r of historico) {
      if (!porCnpj.has(r.cnpj)) porCnpj.set(r.cnpj, { cnpj: r.cnpj, razaoSocial: r.razaoSocial, uf: r.uf });
    }
    return Array.from(porCnpj.values()).sort((a, b) => (a.razaoSocial ?? a.cnpj).localeCompare(b.razaoSocial ?? b.cnpj));
  }, [historico]);

  const [cnpjSelecionado, setCnpjSelecionado] = useState(postos[0]?.cnpj ?? "");
  const cnpjAtual = postos.some((p) => p.cnpj === cnpjSelecionado) ? cnpjSelecionado : (postos[0]?.cnpj ?? "");

  const historicoPosto = useMemo(
    () => historico.filter((r) => r.cnpj === cnpjAtual).sort((a, b) => a.dataRef.localeCompare(b.dataRef)),
    [historico, cnpjAtual]
  );

  const combustiveisPosto = useMemo(() => Array.from(new Set(historicoPosto.map((r) => r.combustivel))).sort(), [historicoPosto]);
  const [combustivelSelecionado, setCombustivelSelecionado] = useState("");
  const combustivelAtual = combustiveisPosto.includes(combustivelSelecionado) ? combustivelSelecionado : (combustiveisPosto[0] ?? "");

  const serieScore = useMemo(() => {
    if (historicoPosto.length === 0) return [];
    const mediaGeral = historicoPosto.reduce((s, r) => s + r.preco, 0) / historicoPosto.length;
    return historicoPosto.map((r) => ({
      data: r.dataRef,
      score: Math.round(scorePrecoSimplificado(r.preco, mediaGeral) * 10) / 10,
    }));
  }, [historicoPosto]);

  const comparativoCombustivel = useMemo(() => {
    if (!combustivelAtual) return null;
    const doPosto = historicoPosto.filter((r) => r.combustivel === combustivelAtual);
    const daRede = historico.filter((r) => r.combustivel === combustivelAtual);
    if (doPosto.length === 0 || daRede.length === 0) return null;
    const mediaPosto = doPosto.reduce((s, r) => s + r.preco, 0) / doPosto.length;
    const mediaRede = daRede.reduce((s, r) => s + r.preco, 0) / daRede.length;
    const deltaPct = mediaRede ? ((mediaPosto - mediaRede) / mediaRede) * 100 : 0;
    const serie = doPosto.map((r) => ({ data: r.dataRef, preco: r.preco }));
    return { mediaPosto, mediaRede, deltaPct, serie };
  }, [historico, historicoPosto, combustivelAtual]);

  const consistencia = useMemo(() => {
    return combustiveisPosto
      .map((c) => {
        const precos = historicoPosto.filter((r) => r.combustivel === c).map((r) => r.preco);
        if (precos.length < 2) return null;
        const media = precos.reduce((a, b) => a + b, 0) / precos.length;
        const variancia = precos.reduce((s, p) => s + (p - media) ** 2, 0) / precos.length;
        const desvio = Math.sqrt(variancia);
        const cv = media ? (desvio / media) * 100 : 0;
        return {
          combustivel: c,
          registros: precos.length,
          min: Math.min(...precos),
          media,
          max: Math.max(...precos),
          desvio,
          cv,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [combustiveisPosto, historicoPosto]);

  if (postos.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Ainda não há histórico de preços por posto.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Posto</label>
          <select value={cnpjAtual} onChange={(e) => setCnpjSelecionado(e.target.value)} className="input w-72 text-sm">
            {postos.map((p) => (
              <option key={p.cnpj} value={p.cnpj}>
                {(p.razaoSocial ?? p.cnpj)} ({p.uf})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">📈 Evolução do score (aproximado por preço vs média histórica do posto)</h3>
        {serieScore.length < 2 ? (
          <p className="text-sm text-slate-400">Histórico insuficiente pra traçar evolução (mínimo 2 registros).</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={serieScore} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} tickFormatter={(v: string) => formatarDataCurta(v)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={(v: string) => formatarDataBr(v)} />
              <ReferenceLine y={75} stroke="#27AE60" strokeDasharray="4 4" label={{ value: "Grau A", fontSize: 10, fill: "#27AE60" }} />
              <ReferenceLine y={55} stroke="#3498DB" strokeDasharray="4 4" label={{ value: "Grau B", fontSize: 10, fill: "#3498DB" }} />
              <ReferenceLine y={35} stroke="#F39C12" strokeDasharray="4 4" label={{ value: "Grau C", fontSize: 10, fill: "#F39C12" }} />
              <Line type="monotone" dataKey="score" stroke="#1565C0" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">⚡ Competitividade vs média da rede</h3>
          {combustiveisPosto.length > 1 && (
            <select value={combustivelAtual} onChange={(e) => setCombustivelSelecionado(e.target.value)} className="input w-auto text-sm">
              {combustiveisPosto.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
        {!comparativoCombustivel ? (
          <p className="text-sm text-slate-400">Sem dados suficientes pra comparar com a média da rede.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={comparativoCombustivel.serie} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} tickFormatter={(v: string) => formatarDataCurta(v)} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                <Tooltip formatter={(v: number) => formatarMoeda(v)} labelFormatter={(v: string) => formatarDataBr(v)} />
                <ReferenceLine
                  y={comparativoCombustivel.mediaRede}
                  stroke="#E65100"
                  strokeDasharray="4 4"
                  label={{ value: `Média rede ${formatarMoeda(comparativoCombustivel.mediaRede)}`, fontSize: 10, fill: "#E65100" }}
                />
                <Line type="monotone" dataKey="preco" name="Preço do posto" stroke="#1565C0" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-sm text-slate-600">
              Preço médio do posto: <strong>{formatarMoeda(comparativoCombustivel.mediaPosto)}</strong> · Média da rede:{" "}
              <strong>{formatarMoeda(comparativoCombustivel.mediaRede)}</strong> · Posição:{" "}
              <span className={comparativoCombustivel.deltaPct < 0 ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                {comparativoCombustivel.deltaPct < 0 ? "🟢 Abaixo" : "🔴 Acima"} da média em {Math.abs(comparativoCombustivel.deltaPct).toFixed(1)}%
              </span>
            </p>
          </>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">🎯 Consistência de preço por combustível</h3>
        <p className="mb-3 text-xs text-slate-400">
          Postos com CV baixo são mais previsíveis pra planejamento de custo. 🟢 CV &lt; 2% · 🟡 CV 2-5% · 🔴 CV &gt; 5%.
        </p>
        {consistencia.length === 0 ? (
          <p className="text-sm text-slate-400">Histórico insuficiente (mínimo 2 registros por combustível).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Combustível</th>
                  <th className="py-2 pr-3">Registros</th>
                  <th className="py-2 pr-3">Mínimo</th>
                  <th className="py-2 pr-3">Médio</th>
                  <th className="py-2 pr-3">Máximo</th>
                  <th className="py-2 pr-3">CV</th>
                  <th className="py-2">Consistência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consistencia.map((c) => (
                  <tr key={c.combustivel}>
                    <td className="py-2 pr-3 text-slate-700">{c.combustivel}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{c.registros}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(c.min)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700">{formatarMoeda(c.media)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(c.max)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{c.cv.toFixed(2)}%</td>
                    <td className="py-2">{c.cv < 2 ? "🟢 Alta" : c.cv < 5 ? "🟡 Média" : "🔴 Baixa"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
