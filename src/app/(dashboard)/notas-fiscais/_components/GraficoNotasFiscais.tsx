"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos (04/09/2026, pedido do Daniel) — evolução do % de
// recolha de NF-e ao longo dos últimos ciclos de faturamento + distribuição
// de status do ciclo selecionado, a partir dos dados já carregados pela
// página (RPC nfe_recolha_por_ciclo, sem query nova).
export type ItemCicloPercentual = { label: string; percentual: number };
export type ItemStatusNfe = { label: string; total: number };

const CORES_STATUS: Record<string, string> = {
  Emitida: "#16a34a",
  Rejeitada: "#dc2626",
  Pendente: CORES_GRAFICO.acento,
};

export function GraficoNotasFiscais({
  evolucaoPercentual,
  statusCicloAtivo,
}: {
  evolucaoPercentual: ItemCicloPercentual[];
  statusCicloAtivo: ItemStatusNfe[];
}) {
  const comStatus = statusCicloAtivo.filter((s) => s.total > 0);
  if (evolucaoPercentual.length === 0 && comStatus.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">% de recolha por ciclo</p>
        {evolucaoPercentual.length === 0 ? (
          <p className="text-sm text-slate-400">Sem ciclos suficientes ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={evolucaoPercentual} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Bar dataKey="percentual" name="Recolha" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Status do ciclo selecionado</p>
        {comStatus.length === 0 ? (
          <p className="text-sm text-slate-400">Sem abastecimentos neste ciclo.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={comStatus} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {comStatus.map((d) => (
                      <Cell key={d.label} fill={CORES_STATUS[d.label] ?? CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} abastecimento${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {comStatus.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: CORES_STATUS[d.label] ?? CORES_GRAFICO.neutro }}
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
    </div>
  );
}
