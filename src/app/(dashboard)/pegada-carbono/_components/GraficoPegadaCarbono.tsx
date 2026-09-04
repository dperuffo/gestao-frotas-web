"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — pizza de CO2 por categoria de
// combustível, a partir das linhas já carregadas pela RPC
// pegada_carbono_periodo (sem query nova).
export type ItemCo2 = { label: string; toneladas: number };

export function GraficoPegadaCarbono({ dados }: { dados: ItemCo2[] }) {
  if (dados.length === 0) return null;
  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">CO2 estimado por combustível</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div style={{ width: 140, height: 140 }} className="mx-auto shrink-0 sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dados} dataKey="toneladas" nameKey="label" innerRadius={38} outerRadius={62} paddingAngle={2}>
                {dados.map((d, i) => (
                  <Cell key={d.label} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} t`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-1.5 text-sm">
          {dados.map((d, i) => (
            <li key={d.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-600">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length] }}
                  aria-hidden="true"
                />
                {d.label}
              </span>
              <span className="whitespace-nowrap font-medium text-slate-900">
                {d.toneladas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} t
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
