"use client";

import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoFluxoCaixaPosto = { diaLabel: string; aReceber: number; aPagar: number };

// Fase 27.64 — fluxo de caixa previsto do período selecionado: quanto
// vence (a receber, das faturas; a pagar, das despesas) em cada dia. Barras
// agrupadas (não linha) porque só há 2 séries e o interesse é comparar
// dia a dia, não ver tendência suave.
export function GraficoFluxoCaixaPosto({ dados }: { dados: PontoFluxoCaixaPosto[] }) {
  // Fase Dark-Mode — mesmo padrão de GraficoPrevisaoConsumo.tsx: cor
  // condicional ao tema pros ticks/grade/tooltip não ficarem ilegíveis
  // (cinza claro sobre fundo escuro) no modo Escuro.
  const { resolvedTheme } = useTheme();
  const corEixo = resolvedTheme === "dark" ? "#94A3B8" : "#64748B";
  const corGrade = resolvedTheme === "dark" ? "#334155" : "#e2e8f0";

  const semMovimento = dados.every((d) => d.aReceber === 0 && d.aPagar === 0);
  if (dados.length === 0 || semMovimento) {
    return <p className="p-4 text-sm text-slate-400">Sem vencimentos no período selecionado.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
        <XAxis dataKey="diaLabel" tick={{ fontSize: 11, fill: corEixo }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12, fill: corEixo }} />
        <Tooltip
          formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          contentStyle={
            resolvedTheme === "dark"
              ? { backgroundColor: "#1e293b", borderColor: "#334155", color: "#f1f5f9" }
              : undefined
          }
        />
        <Legend wrapperStyle={{ fontSize: 11, color: corEixo }} />
        <Bar dataKey="aReceber" name="A receber" fill="#16A34A" radius={[3, 3, 0, 0]} />
        <Bar dataKey="aPagar" name="A pagar" fill="#DC2626" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
