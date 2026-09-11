"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos-Comercial-Posto (09/09/2026) — barra horizontal do
// diff_pct (seu preço vs. referência ANP) por combustível, mesmo padrão de
// cor do resto do app: vermelho acima da referência, verde abaixo.
export type ItemPrecoRegional = { combustivel: string; diff_pct: number };

export function GraficoPrecoRegional({ dados }: { dados: ItemPrecoRegional[] }) {
  if (dados.length === 0) return null;

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Diferença vs. referência ANP</p>
      <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 36)}>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`} />
          <YAxis type="category" dataKey="combustivel" width={130} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`} />
          <Bar dataKey="diff_pct" name="Diferença" radius={[0, 4, 4, 0]}>
            {dados.map((d) => (
              <Cell key={d.combustivel} fill={d.diff_pct > 0 ? "#dc2626" : "#16a34a"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
