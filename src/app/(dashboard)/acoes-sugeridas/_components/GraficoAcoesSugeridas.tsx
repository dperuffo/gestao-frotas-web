"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 2 (04/09/2026) — distribuição das pendentes por
// tipo (pizza) e por severidade (barras), a partir da mesma query de KPIs
// que a página já fazia (só adicionamos "tipo" ao select, sem query nova).
export type ItemDistribuicao = { label: string; total: number };

const CORES_SEVERIDADE: Record<string, string> = {
  Crítica: "#dc2626",
  Alta: "#d97706",
  Média: "#0ea5e9",
  Baixa: "#16a34a",
};

function Pizza({ dados }: { dados: ItemDistribuicao[] }) {
  if (dados.length === 0) return <p className="text-sm text-slate-400">Sem pendências.</p>;
  return (
    <div className="flex items-center gap-4">
      <div style={{ width: 110, height: 110 }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
              {dados.map((d, i) => (
                <Cell key={d.label} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => `${v} ação${v === 1 ? "" : "ões"}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1 text-sm">
        {dados.map((d, i) => (
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
  );
}

export function GraficoAcoesSugeridas({
  porTipo,
  porSeveridade,
}: {
  porTipo: ItemDistribuicao[];
  porSeveridade: ItemDistribuicao[];
}) {
  if (porTipo.length === 0 && porSeveridade.length === 0) return null;
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Pendentes por tipo</p>
        <Pizza dados={porTipo} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Pendentes por severidade</p>
        {porSeveridade.length === 0 ? (
          <p className="text-sm text-slate-400">Sem pendências.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, porSeveridade.length * 32)}>
            <BarChart data={porSeveridade} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v} ação${v === 1 ? "" : "ões"}`} />
              <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                {porSeveridade.map((d) => (
                  <Cell key={d.label} fill={CORES_SEVERIDADE[d.label] ?? CORES_GRAFICO.primaria} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
