"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos (04/09/2026, pedido do Daniel) — distribuição por
// status + ranking das contrapartes com mais negociações, a partir dos
// registros já carregados pela página (sem query nova).
export type ItemStatusNegociacao = { label: string; total: number };
export type ItemContraparte = { nome: string; total: number };

export function GraficoNegociacoes({
  porStatus,
  topContrapartes,
  tituloRanking,
}: {
  porStatus: ItemStatusNegociacao[];
  topContrapartes: ItemContraparte[];
  tituloRanking: string;
}) {
  const comStatus = porStatus.filter((s) => s.total > 0);
  if (comStatus.length === 0 && topContrapartes.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Negociações por status</p>
        {comStatus.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={comStatus} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {comStatus.map((d, i) => (
                      <Cell key={d.label} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} negociação${v === 1 ? "" : "ões"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
              {comStatus.map((d, i) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length] }}
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
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">{tituloRanking}</p>
        {topContrapartes.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, topContrapartes.length * 30)}>
            <BarChart data={topContrapartes} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v} negociação${v === 1 ? "" : "ões"}`} />
              <Bar dataKey="total" name="Negociações" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
