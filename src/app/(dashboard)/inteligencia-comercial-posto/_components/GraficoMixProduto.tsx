"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos-Comercial-Posto (09/09/2026) — % de clientes que já
// compraram cada produto pelo menos uma vez ("cobertura"), pra ver de
// cara qual produto tem menor penetração na carteira — oportunidade de
// cross-sell mais óbvia que ler a matriz cliente×produto linha a linha.
export type ItemMixProduto = { produto: string; comprou: boolean };

export function GraficoMixProduto({ dados, totalClientes }: { dados: ItemMixProduto[]; totalClientes: number }) {
  if (dados.length === 0 || totalClientes === 0) return null;

  const produtos = Array.from(new Set(dados.map((d) => d.produto)));
  const cobertura = produtos
    .map((produto) => {
      const qtd = dados.filter((d) => d.produto === produto && d.comprou).length;
      return { produto, pct: Math.round((qtd / totalClientes) * 100), qtd };
    })
    .sort((a, b) => a.pct - b.pct);

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Cobertura de clientes por produto</p>
      <ResponsiveContainer width="100%" height={Math.max(160, cobertura.length * 34)}>
        <BarChart data={cobertura} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="produto" width={140} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number, _n, item) => `${v}% (${item.payload.qtd} de ${totalClientes} clientes)`} />
          <Bar dataKey="pct" name="Cobertura" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">
        Produto com menor cobertura é o com mais espaço pra oferecer aos clientes que ainda não compram ele aqui.
      </p>
    </div>
  );
}
