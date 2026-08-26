"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemVariacaoPreco = {
  item_nome: string;
  qtd_abastecimentos: number;
  preco_min: number;
  preco_med: number;
  preco_max: number;
  desvio_padrao: number;
  coef_variacao: number;
  uf_referencia: string | null;
  anp_nivel: "estado" | "brasil" | null;
  anp_preco_min: number | null;
  anp_preco_med: number | null;
  anp_preco_max: number | null;
  anp_data_referencia: string | null;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataCurta(valor: string) {
  const [, mes, dia] = valor.split("-");
  return `${dia}/${mes}`;
}

// Barra agrupada (preço médio do cliente x referência ANP) por combustível
// — comparação de dispersão, não série temporal, então barra é mais legível
// que linha aqui. Os números completos (mín/máx/desvio/coeficiente de
// variação) ficam na tabela abaixo, pra não perder precisão no gráfico.
export function GraficoVariacaoPrecos({ dados }: { dados: ItemVariacaoPreco[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem abastecimentos com preço no período.</p>;
  }

  const dadosGrafico = dados.map((d) => ({
    nome: d.item_nome,
    "Preço médio (cliente)": d.preco_med,
    "Preço médio (ANP)": d.anp_preco_med ?? undefined,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(200, dados.length * 50)}>
        <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
          <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(valor: number) => formatarMoeda(valor)} />
          <Legend />
          <Bar dataKey="Preço médio (cliente)" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Preço médio (ANP)" fill="#94a3b8" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-4">Combustível</th>
              <th className="py-2 pr-4">Mín.</th>
              <th className="py-2 pr-4">Médio</th>
              <th className="py-2 pr-4">Máx.</th>
              <th className="py-2 pr-4">Variação</th>
              <th className="py-2 pr-4">ANP médio</th>
              <th className="py-2">Fonte ANP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.map((d) => (
              <tr key={d.item_nome}>
                <td className="py-2 pr-4 text-slate-700">{d.item_nome}</td>
                <td className="py-2 pr-4 tabular-nums text-slate-600">{formatarMoeda(d.preco_min)}</td>
                <td className="py-2 pr-4 tabular-nums font-medium text-slate-900">{formatarMoeda(d.preco_med)}</td>
                <td className="py-2 pr-4 tabular-nums text-slate-600">{formatarMoeda(d.preco_max)}</td>
                <td className="py-2 pr-4 tabular-nums text-slate-600">
                  {(d.coef_variacao * 100).toFixed(1)}%
                  {d.coef_variacao > 0.08 && <span className="ml-1 text-amber-600" title="Alta variação de preço">⚠️</span>}
                </td>
                <td className="py-2 pr-4 tabular-nums text-slate-600">
                  {d.anp_preco_med != null ? formatarMoeda(d.anp_preco_med) : "—"}
                </td>
                <td className="py-2 text-xs text-slate-400">
                  {d.anp_nivel === "estado" ? `Estado (${d.uf_referencia})` : d.anp_nivel === "brasil" ? "Brasil" : "—"}
                  {d.anp_data_referencia && ` · ref. ${formatarDataCurta(d.anp_data_referencia)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
