"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 2 (04/09/2026) — severidade (pizza) + impacto
// estimado por categoria (barras), a partir dos insights já carregados
// pela página (sem query nova).
export type ItemDistribuicao = { label: string; total: number };
export type ItemImpactoCategoria = { label: string; valor: number };

const CORES_SEVERIDADE: Record<string, string> = {
  Crítica: "#dc2626",
  Alta: "#d97706",
  Média: "#0ea5e9",
  Baixa: "#16a34a",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoInsightsIA({
  porSeveridade,
  impactoPorCategoria,
}: {
  porSeveridade: ItemDistribuicao[];
  impactoPorCategoria: ItemImpactoCategoria[];
}) {
  if (porSeveridade.length === 0 && impactoPorCategoria.length === 0) return null;
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Novos por severidade</p>
        {porSeveridade.length === 0 ? (
          <p className="text-sm text-slate-400">Sem insights novos.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 110, height: 110 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porSeveridade} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
                    {porSeveridade.map((d) => (
                      <Cell key={d.label} fill={CORES_SEVERIDADE[d.label] ?? CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} insight${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1 text-sm">
              {porSeveridade.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: CORES_SEVERIDADE[d.label] ?? CORES_GRAFICO.neutro }}
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
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Impacto estimado por categoria (novos)</p>
        {impactoPorCategoria.length === 0 ? (
          <p className="text-sm text-slate-400">Sem impacto estimado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, impactoPorCategoria.length * 30)}>
            <BarChart data={impactoPorCategoria} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Impacto" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
