"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemRankingGasto = {
  chave: string;
  label: string;
  sub?: string | null;
  gasto: number;
  litros: number;
  qtd: number;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Barra horizontal (Top 10) + tabela completa dos itens carregados — pra
// frotas de 1000+ veículos/motoristas, um gráfico com todos os itens fica
// ilegível; o gráfico destaca só os piores casos, a tabela dá o detalhe.
export function RankingGasto({ itens, colunaExtra }: { itens: ItemRankingGasto[]; colunaExtra: string }) {
  if (itens.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem abastecimentos no período selecionado.</p>;
  }

  const dadosGrafico = itens
    .slice(0, 10)
    .map((i) => ({ nome: i.label, gasto: i.gasto }))
    .reverse();

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(180, dadosGrafico.length * 32)}>
        <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
          <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => formatarMoeda(v)} />
          <Bar dataKey="gasto" name="Gasto" fill="#1E40AF" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">{colunaExtra}</th>
              <th className="py-2 pr-4">Gasto</th>
              <th className="py-2 pr-4">Litros</th>
              <th className="py-2">Abastecimentos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((item, i) => (
              <tr key={item.chave}>
                <td className="py-2 pr-4 text-xs font-semibold text-slate-400">{i + 1}</td>
                <td className="py-2 pr-4 text-slate-700">
                  {item.label}
                  {item.sub && <span className="ml-1 text-xs text-slate-400">{item.sub}</span>}
                </td>
                <td className="py-2 pr-4 tabular-nums font-medium text-slate-900">{formatarMoeda(item.gasto)}</td>
                <td className="py-2 pr-4 tabular-nums text-slate-600">
                  {item.litros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L
                </td>
                <td className="py-2 tabular-nums text-slate-600">{item.qtd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
