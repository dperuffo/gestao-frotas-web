"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 3 (04/09/2026) — estado atual (pizza) + ranking
// de horas dirigidas no período (top 8), a partir do statusAtual e
// rankingMotoristas já carregados pela página (sem query nova).
export type ItemEstado = { label: string; total: number };
export type ItemRankingHoras = { nome: string; horas: number };

const CORES_ESTADO: Record<string, string> = {
  Dirigindo: "#16a34a",
  "Em pausa": "#d97706",
  Descansando: "#0ea5e9",
  "Nunca iniciou": CORES_GRAFICO.neutro,
};

export function GraficoResumoJornada({
  porEstado,
  rankingHoras,
}: {
  porEstado: ItemEstado[];
  rankingHoras: ItemRankingHoras[];
}) {
  const comEstado = porEstado.filter((e) => e.total > 0);
  if (comEstado.length === 0 && rankingHoras.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Estado atual dos motoristas</p>
        {comEstado.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={comEstado} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {comEstado.map((d) => (
                      <Cell key={d.label} fill={CORES_ESTADO[d.label] ?? CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} motorista${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {comEstado.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: CORES_ESTADO[d.label] ?? CORES_GRAFICO.neutro }}
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
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Mais horas dirigidas no período (top 8)</p>
        {rankingHoras.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, rankingHoras.length * 28)}>
            <BarChart data={rankingHoras} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}h`} />
              <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} />
              <Bar dataKey="horas" name="Horas dirigidas" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
