"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { formatarNomeEixoGrafico } from "@/lib/formatarNomeEixoGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — distribuição por nível + adesão
// (pizzas) + ranking de pontos, tudo a partir do indicadores já carregado
// pela página (sem query nova).
export type ItemDistribuicao = { label: string; total: number };
export type ItemRankingPontos = { nome: string; pontos: number };

function Pizza({ dados, cores }: { dados: ItemDistribuicao[]; cores: (i: number) => string }) {
  if (dados.length === 0) return <p className="text-sm text-slate-400">Sem dados.</p>;
  return (
    <div className="flex items-center gap-4">
      <div style={{ width: 110, height: 110 }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
              {dados.map((d, i) => (
                <Cell key={d.label} fill={cores(i)} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => `${v} motorista${v === 1 ? "" : "s"}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1 text-sm">
        {dados.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cores(i) }} aria-hidden="true" />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-medium text-slate-900">{d.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GraficoFidelidade({
  porNivel,
  porAdesao,
  rankingPontos,
}: {
  porNivel: ItemDistribuicao[];
  porAdesao: ItemDistribuicao[];
  rankingPontos: ItemRankingPontos[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por nível</p>
        <Pizza dados={porNivel} cores={(i) => CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Adesão ao programa</p>
        <Pizza dados={porAdesao} cores={(i) => (i === 0 ? "#16a34a" : CORES_GRAFICO.neutro)} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Maior saldo de pontos (top 8)</p>
        {rankingPontos.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, rankingPontos.length * 36)}>
            <BarChart
              data={rankingPontos}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="nome"
                width={190}
                tick={{ fontSize: 11 }}
                tickFormatter={(nome: string) => formatarNomeEixoGrafico(nome)}
                interval={0}
              />
              <Tooltip
                formatter={(v: number) => `${v.toLocaleString("pt-BR")} pts`}
                labelFormatter={(nome: string) => nome}
              />
              <Bar dataKey="pontos" name="Pontos" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
