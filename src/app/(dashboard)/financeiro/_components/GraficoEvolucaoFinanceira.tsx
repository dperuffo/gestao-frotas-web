"use client";

import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

export type PontoFinanceiro = {
  mes: string;
  combustivel: number;
  manutencao: number;
  custosFixos: number;
};

export function GraficoEvolucaoFinanceira({ dados }: { dados: PontoFinanceiro[] }) {
  // Fase Dark-Mode — mesmo padrão de GraficoPrevisaoConsumo.tsx.
  const { resolvedTheme } = useTheme();
  const corEixo = resolvedTheme === "dark" ? "#94A3B8" : "#64748B";
  const corGrade = resolvedTheme === "dark" ? "#334155" : CORES_GRAFICO.grade;

  if (dados.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Ainda não há dados suficientes para o gráfico.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: corEixo }} />
        <YAxis tick={{ fontSize: 12, fill: corEixo }} />
        <Tooltip
          formatter={(valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          contentStyle={
            resolvedTheme === "dark"
              ? { backgroundColor: "#1e293b", borderColor: "#334155", color: "#f1f5f9" }
              : undefined
          }
        />
        <Legend wrapperStyle={{ color: corEixo }} />
        <Bar dataKey="combustivel" name="Combustível" stackId="custo" fill={CORES_GRAFICO.primaria} />
        <Bar dataKey="manutencao" name="Manutenção" stackId="custo" fill={CORES_GRAFICO.neutro} />
        <Bar dataKey="custosFixos" name="Custos fixos" stackId="custo" fill="#F59E0B" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
