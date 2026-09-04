"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

export type PontoTopPosto = { posto: string; litros: number };

// Barra horizontal — ranking de poucos itens (5) com nomes longos; barra
// horizontal deixa o rótulo inteiro legível, diferente de barra vertical.
export function GraficoTopPostos({ dados }: { dados: PontoTopPosto[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem abastecimentos no período selecionado.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, dados.length * 44)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="posto" width={180} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
        <Bar dataKey="litros" name="Litros" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
