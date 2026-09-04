"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

export type PontoConsumo = {
  mes: string;
  litros: number;
  valor: number;
};

export function GraficoConsumo({ dados }: { dados: PontoConsumo[] }) {
  if (dados.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Ainda não há abastecimentos suficientes para o gráfico.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="litros" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="valor" orientation="right" tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(valor: number, nome: string) =>
            nome === "Valor (R$)" ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : valor
          }
        />
        <Legend />
        <Bar yAxisId="litros" dataKey="litros" name="Litros" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
        <Bar yAxisId="valor" dataKey="valor" name="Valor (R$)" fill={CORES_GRAFICO.neutro} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
