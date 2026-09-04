"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 5 (04/09/2026, pedido do Daniel) — volume de
// rotogramas emitidos por mês (últimos 6 meses) + top 5 rotas mais
// frequentes, a partir dos rotogramas já carregados pela página (sem
// query nova).
export type ItemVolumeMes = { mes: string; total: number };
export type ItemRota = { rota: string; total: number };

export function GraficoRotograma({
  volumePorMes,
  topRotas,
}: {
  volumePorMes: ItemVolumeMes[];
  topRotas: ItemRota[];
}) {
  const comVolume = volumePorMes.some((v) => v.total > 0);
  if (!comVolume && topRotas.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Rotogramas emitidos por mês</p>
        {!comVolume ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumePorMes} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => `${v} rotograma${v === 1 ? "" : "s"}`} />
              <Bar dataKey="total" name="Rotogramas" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Rotas mais frequentes (top 5)</p>
        {topRotas.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, topRotas.length * 32)}>
            <BarChart data={topRotas} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="rota" width={130} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v} viagem${v === 1 ? "" : "ns"}`} />
              <Bar dataKey="total" name="Viagens" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
