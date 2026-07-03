"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemAlertaEstado = { uf: string; postosAlerta: number; piorDesvio: number };

function corPorDesvio(desvio: number) {
  if (desvio > 10) return "#B71C1C";
  if (desvio > 7) return "#E53935";
  return "#EF9A9A";
}

// Barra horizontal — quantidade de postos em alerta por estado, cor mais
// forte quanto pior o desvio máximo encontrado naquele estado (não a
// quantidade — um estado com poucos postos mas desvio absurdo chama mais
// atenção do que um com muitos postos e desvio pequeno).
export function GraficoAlertasPorEstado({ dados }: { dados: ItemAlertaEstado[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Nenhum posto em alerta de preço no momento.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 28)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
        <YAxis type="category" dataKey="uf" width={40} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(v: number, name: string) => (name === "postosAlerta" ? `${v} postos` : `+${v.toFixed(1)}%`)}
          labelFormatter={(uf) => `Estado: ${uf}`}
        />
        <Bar dataKey="postosAlerta" name="Postos em alerta" radius={[0, 4, 4, 0]}>
          {dados.map((d) => (
            <Cell key={d.uf} fill={corPorDesvio(d.piorDesvio)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
