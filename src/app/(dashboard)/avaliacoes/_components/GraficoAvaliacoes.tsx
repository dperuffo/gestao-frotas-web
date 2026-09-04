"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 2 (04/09/2026) — distribuição de estrelas +
// ranking de nota média por cliente (com pelo menos 2 avaliações), a partir
// da lista já carregada pela página (sem query nova).
export type ItemDistribuicaoEstrelas = { estrelas: number; total: number };
export type ItemNotaMediaCliente = { cliente: string; media: number };

export function GraficoAvaliacoes({
  distribuicao,
  rankingClientes,
}: {
  distribuicao: ItemDistribuicaoEstrelas[];
  rankingClientes: ItemNotaMediaCliente[];
}) {
  const dadosDistribuicao = distribuicao.map((d) => ({ ...d, label: `${d.estrelas}★` }));

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Distribuição de notas</p>
        {dadosDistribuicao.every((d) => d.total === 0) ? (
          <p className="text-sm text-slate-400">Sem avaliações.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dadosDistribuicao} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => `${v} avaliação${v === 1 ? "" : "ões"}`} />
              <Bar dataKey="total" name="Avaliações" radius={[4, 4, 0, 0]}>
                {dadosDistribuicao.map((d) => (
                  <Cell key={d.estrelas} fill={d.estrelas >= 4 ? "#16a34a" : d.estrelas === 3 ? "#d97706" : "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Nota média por cliente (2+ avaliações)</p>
        {rankingClientes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum cliente com 2+ avaliações ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, rankingClientes.length * 28)}>
            <BarChart data={rankingClientes} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="cliente" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)} ★`} />
              <Bar dataKey="media" name="Nota média" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
