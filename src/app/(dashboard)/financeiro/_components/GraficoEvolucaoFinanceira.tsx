"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoFinanceiro = {
  mes: string;
  combustivel: number;
  manutencao: number;
  custosFixos: number;
};

export function GraficoEvolucaoFinanceira({ dados }: { dados: PontoFinanceiro[] }) {
  if (dados.length === 0) {
    return <p className="p-6 text-sm text-slate-400">Ainda não há dados suficientes para o gráfico.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        />
        <Legend />
        <Bar dataKey="combustivel" name="Combustível" stackId="custo" fill="#262626" />
        <Bar dataKey="manutencao" name="Manutenção" stackId="custo" fill="#8C8C8C" />
        <Bar dataKey="custosFixos" name="Custos fixos" stackId="custo" fill="#F59E0B" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
