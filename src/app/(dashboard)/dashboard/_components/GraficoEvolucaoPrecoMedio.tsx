"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoPrecoMedio = {
  diaLabel: string;
  precoMedio: number;
};

// Linha — evolução (tendência contínua) fica mais clara em linha do que em
// barras, principalmente com muitos pontos (1 por dia no mês).
export function GraficoEvolucaoPrecoMedio({ dados }: { dados: PontoPrecoMedio[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem abastecimentos no período selecionado.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="diaLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
        <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <Line type="monotone" dataKey="precoMedio" name="Preço médio (R$/L)" stroke="#0F2A4A" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
