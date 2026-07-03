"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemOportunidade = {
  uf: string;
  postosGf: number;
  penetracaoPct: number;
  dieselAnp: number | null;
  score: number;
};

function corPorScore(score: number) {
  if (score >= 80) return "#B71C1C";
  if (score >= 60) return "#E65100";
  if (score >= 40) return "#F57F17";
  return "#1565C0";
}

// Score = quanto menor a penetração GF e maior o preço do diesel na região,
// maior a oportunidade de levar a rede pra lá — mesmo cálculo do painel
// Executivo do Streamlit.
export function GraficoOportunidadesExpansao({ dados }: { dados: ItemOportunidade[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem dados suficientes para calcular oportunidades.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="uf" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => v.toFixed(0)} labelFormatter={(uf) => `Estado: ${uf}`} />
        <Bar dataKey="score" name="score" radius={[4, 4, 0, 0]}>
          {dados.map((d) => (
            <Cell key={d.uf} fill={corPorScore(d.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
