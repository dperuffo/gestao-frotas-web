"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoPrevisaoConsumo = {
  diaLabel: string;
  litros: number;
  tipo: "real" | "projetado";
};

// Barras: dias já ocorridos em azul sólido, dias projetados (calibrados
// pelo padrão de consumo por dia da semana) em azul claro — pedido
// explicitamente como gráfico de barras.
export function GraficoPrevisaoConsumo({ dados }: { dados: PontoPrevisaoConsumo[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem abastecimentos no período selecionado.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="diaLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(valor: number, _nome: string, item) => [
            `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`,
            item.payload.tipo === "projetado" ? "Litros (projetado)" : "Litros (real)",
          ]}
        />
        <Legend
          payload={[
            { value: "Realizado", type: "square", color: "#262626" },
            { value: "Projetado", type: "square", color: "#D9D9D9" },
          ]}
        />
        <Bar dataKey="litros" radius={[4, 4, 0, 0]}>
          {dados.map((d, i) => (
            <Cell key={i} fill={d.tipo === "projetado" ? "#D9D9D9" : "#262626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
