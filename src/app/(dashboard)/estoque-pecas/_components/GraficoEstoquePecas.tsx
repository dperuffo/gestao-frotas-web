"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { GaugeIndicador } from "@/app/(dashboard)/indicadores-frota/_components/GaugeIndicador";

// Fase Plano-Graficos Onda 1 (04/09/2026) — gauge de % abaixo do mínimo +
// pizza de situação + ranking de valor em estoque (top 8), tudo a partir do
// pecasRaw já carregado pela página (sem query nova).
export type ItemRankingValor = { nome: string; valor: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoEstoquePecas({
  percentualAbaixoMinimo,
  totalOk,
  totalRepor,
  rankingValor,
}: {
  percentualAbaixoMinimo: number;
  totalOk: number;
  totalRepor: number;
  rankingValor: ItemRankingValor[];
}) {
  const situacao = [
    { label: "OK", total: totalOk },
    { label: "Repor", total: totalRepor },
  ].filter((d) => d.total > 0);

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <div className="flex flex-col items-center justify-center">
        <GaugeIndicador
          label="% abaixo do mínimo"
          valor={percentualAbaixoMinimo}
          min={0}
          max={100}
          invertido
          zonaVermelha={20}
          zonaVerde={5}
          unidade="percentual"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Situação do estoque</p>
        {situacao.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 110, height: 110 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={situacao} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
                    {situacao.map((d) => (
                      <Cell key={d.label} fill={d.label === "OK" ? "#16a34a" : "#dc2626"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} peça${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1 text-sm">
              {situacao.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: d.label === "OK" ? "#16a34a" : "#dc2626" }}
                    aria-hidden="true"
                  />
                  <span className="text-slate-600">{d.label}</span>
                  <span className="font-medium text-slate-900">{d.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Maior valor em estoque (top 8)</p>
        {rankingValor.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, rankingValor.length * 28)}>
            <BarChart data={rankingValor} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Valor em estoque" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
