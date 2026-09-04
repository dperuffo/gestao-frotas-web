"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos (04/09/2026, pedido do Daniel) — distribuição de
// recomendação (pizza) + ranking dos veículos com maior economia (%),
// reaproveitando os itens já carregados pela página (RPCs
// comparador_combustivel_ideal / comparador_diesel_ideal, sem query nova).
// Um componente só, usado nas duas abas (Flex e Diesel) com rótulos/cores
// diferentes.
export type ItemDistribuicaoRecomendacao = { label: string; total: number };
export type ItemRankingEconomia = { placa: string; economiaPct: number };

export function GraficoCombustivelIdeal({
  distribuicao,
  coresDistribuicao,
  ranking,
  tituloDistribuicao,
  tituloRanking,
}: {
  distribuicao: ItemDistribuicaoRecomendacao[];
  coresDistribuicao: Record<string, string>;
  ranking: ItemRankingEconomia[];
  tituloDistribuicao: string;
  tituloRanking: string;
}) {
  const comDados = distribuicao.filter((d) => d.total > 0);
  if (comDados.length === 0 && ranking.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">{tituloDistribuicao}</p>
        {comDados.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={comDados} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {comDados.map((d) => (
                      <Cell key={d.label} fill={coresDistribuicao[d.label] ?? CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} veículo${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {comDados.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: coresDistribuicao[d.label] ?? CORES_GRAFICO.neutro }}
                    aria-hidden="true"
                  />
                  <span className="text-slate-600">{d.label}</span>
                  <span className="font-medium text-slate-900">{d.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">{tituloRanking}</p>
        {ranking.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados suficientes ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, ranking.length * 28)}>
            <BarChart data={ranking} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="placa" width={70} tick={{ fontSize: 10, fontFamily: "monospace" }} />
              <Tooltip formatter={(v: number) => `${v}% mais barato`} />
              <Bar dataKey="economiaPct" name="Economia" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
