"use client";

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
  if (dados.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Ainda não há jornadas registradas suficientes para o gráfico.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit="h" />
        <Tooltip formatter={(valor: number) => `${valor.toFixed(1)}h`} />
        <Legend />
        <Bar dataKey="horasDirigidas" name="Dirigindo" stackId="jornada" fill="#1B7A43" radius={[0, 0, 0, 0]} />
        <Bar dataKey="horasPausa" name="Pausa" stackId="jornada" fill="#B8860B" radius={[0, 0, 0, 0]} />
        <Bar dataKey="horasDescanso" name="Descanso" stackId="jornada" fill="#1E6FBF" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
