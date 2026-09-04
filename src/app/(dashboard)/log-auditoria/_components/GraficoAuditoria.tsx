"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — timeline de eventos por dia +
// ranking por usuário, calculados a partir de uma amostra recente (até 500
// registros, respeitando os filtros ativos) já que a tabela é paginada e
// não representaria o todo.
export type ItemEventosDia = { dia: string; total: number };
export type ItemRankingUsuario = { usuario: string; total: number };
export type ItemPorAcao = { label: string; total: number };

export function GraficoAuditoria({
  eventosPorDia,
  rankingUsuario,
  porAcao,
}: {
  eventosPorDia: ItemEventosDia[];
  rankingUsuario: ItemRankingUsuario[];
  porAcao: ItemPorAcao[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Eventos por dia (amostra recente)</p>
        {eventosPorDia.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={eventosPorDia} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => `${v} evento${v === 1 ? "" : "s"}`} />
              <Bar dataKey="total" name="Eventos" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por usuário (top 8)</p>
        {rankingUsuario.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, rankingUsuario.length * 28)}>
            <BarChart data={rankingUsuario} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="usuario" width={130} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v} evento${v === 1 ? "" : "s"}`} />
              <Bar dataKey="total" name="Eventos" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por ação</p>
        {porAcao.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 110, height: 110 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porAcao} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
                    {porAcao.map((d, i) => (
                      <Cell key={d.label} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} evento${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1 text-sm">
              {porAcao.map((d, i) => (
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
    </div>
  );
}
