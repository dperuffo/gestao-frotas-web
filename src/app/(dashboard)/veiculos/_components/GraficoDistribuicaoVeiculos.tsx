"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026, pedido do Daniel: "aplicação mais
// gráfica, com mais dashboards e menos listas de informações, em todas as
// funcionalidades") — a tela de Veículos era 100% tabela; os dados de
// tipo/status/centro de custo já vêm carregados pra tabela, então o gráfico
// aqui não faz nenhuma query nova, só resume o mesmo array antes da tabela
// de detalhe (mesmo padrão do Dashboard: gráfico em cima, tabela embaixo
// pro drill-down linha a linha).
export type ItemDistribuicao = { label: string; total: number };

const CORES = CORES_GRAFICO.serie;

function Pizza({ dados, titulo }: { dados: ItemDistribuicao[]; titulo: string }) {
  if (dados.length === 0) {
    return <p className="text-sm text-slate-400">Sem dados.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">{titulo}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div style={{ width: 120, height: 120 }} className="mx-auto shrink-0 sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dados} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                {dados.map((d, i) => (
                  <Cell key={d.label} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} veículo${v === 1 ? "" : "s"}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-1.5 text-sm">
          {dados.map((d, i) => (
            <li key={d.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-600">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: CORES[i % CORES.length] }}
                  aria-hidden="true"
                />
                {d.label}
              </span>
              <span className="whitespace-nowrap font-medium text-slate-900">{d.total}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function GraficoDistribuicaoVeiculos({
  porTipo,
  porStatus,
  porCentroCusto,
}: {
  porTipo: ItemDistribuicao[];
  porStatus: ItemDistribuicao[];
  porCentroCusto: ItemDistribuicao[];
}) {
  const rankingCentroCusto = porCentroCusto.slice(0, 8).reverse();

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <Pizza dados={porTipo} titulo="Por tipo de veículo" />
      <Pizza dados={porStatus} titulo="Por status" />
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">
          Veículos por centro de custo {porCentroCusto.length > 8 ? "(top 8)" : ""}
        </p>
        {rankingCentroCusto.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, rankingCentroCusto.length * 28)}>
            <BarChart data={rankingCentroCusto} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v} veículo${v === 1 ? "" : "s"}`} />
              <Bar dataKey="total" name="Veículos" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
