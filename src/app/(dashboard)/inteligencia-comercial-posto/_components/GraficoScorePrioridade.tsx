"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { formatarNomeEixoGrafico } from "@/lib/formatarNomeEixoGrafico";

// Fase Plano-Graficos-Comercial-Posto (09/09/2026, pedido do Daniel: "é
// possível planejarmos gráficos visuais?" pras 9 abas de Inteligência
// Comercial do posto) — donut de distribuição por prioridade (mesmo padrão
// de GraficoAcoesSugeridas) + barra dos clientes com maior score, pra
// priorizar quem contatar primeiro sem precisar rolar a tabela inteira.
export type ItemScoreCliente = { nome: string; score: number; prioridade: string };

const PRIORIDADE_LABEL: Record<string, string> = { critico: "Crítico", atencao: "Atenção", saudavel: "Saudável" };
const CORES_PRIORIDADE: Record<string, string> = {
  critico: "#dc2626",
  atencao: "#d97706",
  saudavel: "#16a34a",
};

export function GraficoScorePrioridade({ dados }: { dados: ItemScoreCliente[] }) {
  if (dados.length === 0) return null;

  const distribuicao = ["critico", "atencao", "saudavel"]
    .map((p) => ({ label: PRIORIDADE_LABEL[p], chave: p, total: dados.filter((d) => d.prioridade === p).length }))
    .filter((d) => d.total > 0);

  const top = [...dados].sort((a, b) => b.score - a.score).slice(0, 8).reverse();

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Clientes por prioridade</p>
        <div className="flex items-center gap-4">
          <div style={{ width: 110, height: 110 }} className="shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribuicao} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
                  {distribuicao.map((d) => (
                    <Cell key={d.chave} fill={CORES_PRIORIDADE[d.chave]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v} cliente${v === 1 ? "" : "s"}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 text-sm">
            {distribuicao.map((d) => (
              <li key={d.chave} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CORES_PRIORIDADE[d.chave] }} aria-hidden="true" />
                <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{d.total}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Maiores scores (contatar primeiro)</p>
        <ResponsiveContainer width="100%" height={Math.max(180, top.length * 36)}>
          <BarChart data={top} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="nome"
              width={170}
              tick={{ fontSize: 11 }}
              tickFormatter={(nome: string) => formatarNomeEixoGrafico(nome)}
              interval={0}
            />
            <Tooltip formatter={(v: number) => `Score ${v}`} labelFormatter={(nome: string) => nome} />
            <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]}>
              {top.map((d) => (
                <Cell key={d.nome} fill={CORES_PRIORIDADE[d.prioridade] ?? CORES_GRAFICO.primaria} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
