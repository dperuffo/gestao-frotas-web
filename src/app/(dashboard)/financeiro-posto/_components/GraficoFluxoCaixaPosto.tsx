"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoFluxoCaixaPosto = { diaLabel: string; aReceber: number; aPagar: number };

// Fase 27.64 — fluxo de caixa previsto do período selecionado: quanto
// vence (a receber, das faturas; a pagar, das despesas) em cada dia. Barras
// agrupadas (não linha) porque só há 2 séries e o interesse é comparar
// dia a dia, não ver tendência suave.
export function GraficoFluxoCaixaPosto({ dados }: { dados: PontoFluxoCaixaPosto[] }) {
  const semMovimento = dados.every((d) => d.aReceber === 0 && d.aPagar === 0);
  if (dados.length === 0 || semMovimento) {
    return <p className="p-4 text-sm text-slate-400">Sem vencimentos no período selecionado.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="diaLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="aReceber" name="A receber" fill="#16A34A" radius={[3, 3, 0, 0]} />
        <Bar dataKey="aPagar" name="A pagar" fill="#DC2626" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
