"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 2 (04/09/2026) — visão geral de pendências entre
// os 4 sistemas do hub, num gráfico só, em vez de só números soltos em cada
// card. Dados já vêm calculados pela página (sem query nova).
export type ItemPendencia = { label: string; total: number };

export function GraficoCentralRegras({ dados }: { dados: ItemPendencia[] }) {
  const comDados = dados.filter((d) => d.total > 0);
  if (comDados.length === 0) return null;

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">Pendências por sistema</p>
      <ResponsiveContainer width="100%" height={Math.max(120, comDados.length * 36)}>
        <BarChart data={comDados} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => `${v} pendência${v === 1 ? "" : "s"}`} />
          <Bar dataKey="total" name="Pendências" radius={[0, 4, 4, 0]}>
            {comDados.map((d, i) => (
              <Cell key={d.label} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
