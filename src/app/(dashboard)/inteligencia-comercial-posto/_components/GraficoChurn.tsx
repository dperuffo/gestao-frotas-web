"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Fase Plano-Graficos-Comercial-Posto (09/09/2026) — donut de distribuição
// dos clientes por status de churn, mesmo papel dos 4 IndicadorColorido que
// já existem no topo da aba, só que visual e proporcional.
export type ItemStatusChurn = { status: string };

const LABEL: Record<string, string> = {
  em_dia: "Em dia",
  atencao: "Atenção",
  critico: "Crítico",
  sem_historico: "Sem histórico",
  nunca_abasteceu: "Nunca abasteceu aqui",
};

const CORES: Record<string, string> = {
  em_dia: "#16a34a",
  atencao: "#d97706",
  critico: "#dc2626",
  sem_historico: "#94a3b8",
  nunca_abasteceu: "#64748b",
};

export function GraficoChurn({ dados }: { dados: ItemStatusChurn[] }) {
  if (dados.length === 0) return null;

  const distribuicao = Object.keys(LABEL)
    .map((status) => ({ status, label: LABEL[status], total: dados.filter((d) => d.status === status).length }))
    .filter((d) => d.total > 0);

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Clientes por status</p>
      <div className="flex items-center gap-4">
        <div style={{ width: 120, height: 120 }} className="shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={distribuicao} dataKey="total" nameKey="label" innerRadius={30} outerRadius={56} paddingAngle={2}>
                {distribuicao.map((d) => (
                  <Cell key={d.status} fill={CORES[d.status]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} cliente${v === 1 ? "" : "s"}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1 text-sm">
          {distribuicao.map((d) => (
            <li key={d.status} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CORES[d.status] }} aria-hidden="true" />
              <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{d.total}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
