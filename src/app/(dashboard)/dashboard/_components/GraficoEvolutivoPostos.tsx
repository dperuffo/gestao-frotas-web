"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CORES = ["#262626", "#F97316", "#16A34A", "#DB2777", "#7C3AED"];

export type PontoEvolutivoPostos = { diaLabel: string; [posto: string]: string | number };

// Múltiplas linhas (1 por posto) — comparar a trajetória de até 5
// categorias ao longo do tempo é o caso clássico de linha; barras
// agrupadas com 5 séries por dia ficariam poluídas.
export function GraficoEvolutivoPostos({ dados, postos }: { dados: PontoEvolutivoPostos[]; postos: string[] }) {
  if (dados.length === 0 || postos.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem abastecimentos suficientes para o gráfico.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="diaLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {postos.map((posto, i) => (
          <Line
            key={posto}
            type="monotone"
            dataKey={posto}
            stroke={CORES[i % CORES.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
