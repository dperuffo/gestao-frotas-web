"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { formatarNomeEixoGrafico } from "@/lib/formatarNomeEixoGrafico";

// Fase Plano-Graficos Onda 2 (04/09/2026) — status das conexões (pizza) +
// ranking de registros sincronizados por cliente (top 8), a partir das
// chaves já carregadas pela página (sem query nova).
export type ItemRankingSync = { nome: string; registros: number };

export function GraficoProfrotas({
  totalAtivas,
  totalInativas,
  ranking,
}: {
  totalAtivas: number;
  totalInativas: number;
  ranking: ItemRankingSync[];
}) {
  const status = [
    { label: "Ativas", total: totalAtivas },
    { label: "Inativas", total: totalInativas },
  ].filter((d) => d.total > 0);

  if (status.length === 0 && ranking.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Conexões por status</p>
        {status.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 110, height: 110 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={status} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
                    {status.map((d, i) => (
                      <Cell key={d.label} fill={i === 0 ? "#16a34a" : CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} cliente${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1 text-sm">
              {status.map((d, i) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: i === 0 ? "#16a34a" : CORES_GRAFICO.neutro }}
                    aria-hidden="true"
                  />
                  <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{d.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Mais registros sincronizados (top 8)</p>
        {ranking.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, ranking.length * 36)}>
            <BarChart data={ranking} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="nome"
                width={170}
                tick={{ fontSize: 10 }}
                tickFormatter={(nome: string) => formatarNomeEixoGrafico(nome)}
                interval={0}
              />
              <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} labelFormatter={(nome: string) => nome} />
              <Bar dataKey="registros" name="Registros" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
