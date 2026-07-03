"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemCustoAnp = {
  combustivel: string;
  precoMedio: number;
  referencia: number | null;
  ehOficial: boolean;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Barra agrupada (preço médio da rede GF x referência ANP) por combustível —
// mesma ideia do gráfico de Variação de Preços do Dashboard, mas aqui é a
// rede inteira (todos os clientes), não um cliente específico.
export function GraficoCustoAnp({ dados }: { dados: ItemCustoAnp[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Ainda não há preços cadastrados na rede.</p>;
  }

  const dadosGrafico = dados.map((d) => ({
    nome: d.combustivel,
    "Preço médio GF": d.precoMedio,
    "Referência ANP": d.referencia ?? undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 46)}>
      <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
        <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(valor: number) => formatarMoeda(valor)} />
        <Legend />
        <Bar dataKey="Preço médio GF" fill="#E65100" radius={[0, 4, 4, 0]} />
        <Bar dataKey="Referência ANP" fill="#1565C0" radius={[0, 4, 4, 0]} fillOpacity={0.75} />
      </BarChart>
    </ResponsiveContainer>
  );
}
