"use client";

import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoJornada = {
  dia: string; // dd/mm, já formatado pro eixo
  horasDirigidas: number;
  horasPausa: number;
  horasDescanso: number;
};

// Fase Painel-Jornada-Motorista (17/08/2026) — mesmo padrão visual de
// GraficoConsumo (dashboard principal): barras empilhadas por tipo de tempo
// (dirigindo/pausa/descanso), somando todos os motoristas da empresa por
// dia.
export function GraficoHorasDirigidas({ dados }: { dados: PontoJornada[] }) {
  // Fase Dark-Mode — mesmo padrão de GraficoPrevisaoConsumo.tsx.
  const { resolvedTheme } = useTheme();
  const corEixo = resolvedTheme === "dark" ? "#94A3B8" : "#64748B";
  const corGrade = resolvedTheme === "dark" ? "#334155" : "#e2e8f0";

  if (dados.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Ainda não há jornadas registradas suficientes para o gráfico.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
        <XAxis dataKey="dia" tick={{ fontSize: 12, fill: corEixo }} />
        <YAxis tick={{ fontSize: 12, fill: corEixo }} unit="h" />
        <Tooltip
          formatter={(valor: number) => `${valor.toFixed(1)}h`}
          contentStyle={
            resolvedTheme === "dark"
              ? { backgroundColor: "#1e293b", borderColor: "#334155", color: "#f1f5f9" }
              : undefined
          }
        />
        <Legend wrapperStyle={{ color: corEixo }} />
        <Bar dataKey="horasDirigidas" name="Dirigindo" stackId="jornada" fill="#1B7A43" radius={[0, 0, 0, 0]} />
        <Bar dataKey="horasPausa" name="Pausa" stackId="jornada" fill="#B8860B" radius={[0, 0, 0, 0]} />
        <Bar dataKey="horasDescanso" name="Descanso" stackId="jornada" fill="#1E6FBF" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
