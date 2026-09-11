"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos-Comercial-Posto (09/09/2026) — curva de Pareto
// clássica: barras de receita por cliente (ranking) + linha de % acumulado
// no eixo secundário. É o gráfico que esse dado pede — mostra de cara onde
// a curva "dobra" (concentração de receita nos primeiros clientes).
export type ItemPareto = { nome: string; receita: number; participacao_acumulada_pct: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoPareto({ dados }: { dados: ItemPareto[] }) {
  if (dados.length === 0) return null;

  const top = dados.slice(0, 15);

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
        Curva de concentração de receita (top {top.length})
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={top} margin={{ top: 8, right: 24, left: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
          <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={70} />
          <YAxis
            yAxisId="receita"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="acumulado"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            formatter={(v: number, nome: string) =>
              nome === "Receita" ? formatarMoeda(v) : `${v.toFixed(0)}% acumulado`
            }
          />
          <Bar yAxisId="receita" dataKey="receita" name="Receita" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="acumulado"
            type="monotone"
            dataKey="participacao_acumulada_pct"
            name="% acumulado"
            stroke={CORES_GRAFICO.acento}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
