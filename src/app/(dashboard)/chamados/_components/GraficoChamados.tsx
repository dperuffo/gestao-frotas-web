"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — distribuição por status/tipo
// (pizzas) + por prioridade (barras), tudo a partir do chamados já
// carregado pela página (sem query nova).
export type ItemDistribuicao = { label: string; total: number };

const CORES_STATUS_GRAFICO: Record<string, string> = {
  Aberto: "#d97706",
  "Em análise": "#0ea5e9",
  Resolvido: "#16a34a",
  Fechado: CORES_GRAFICO.neutro,
};

const CORES_PRIORIDADE_GRAFICO: Record<string, string> = {
  Baixa: "#16a34a",
  Média: "#0ea5e9",
  Alta: "#d97706",
  Urgente: "#dc2626",
};

function Pizza({ dados, cores }: { dados: ItemDistribuicao[]; cores: (label: string, i: number) => string }) {
  if (dados.length === 0) return <p className="text-sm text-slate-400">Sem dados.</p>;
  return (
    <div className="flex items-center gap-4">
      <div style={{ width: 110, height: 110 }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
              {dados.map((d, i) => (
                <Cell key={d.label} fill={cores(d.label, i)} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => `${v} chamado${v === 1 ? "" : "s"}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1 text-sm">
        {dados.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cores(d.label, i) }} aria-hidden="true" />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-medium text-slate-900">{d.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GraficoChamados({
  porStatus,
  porTipo,
  porPrioridade,
}: {
  porStatus: ItemDistribuicao[];
  porTipo: ItemDistribuicao[];
  porPrioridade: ItemDistribuicao[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por status</p>
        <Pizza dados={porStatus} cores={(label) => CORES_STATUS_GRAFICO[label] ?? CORES_GRAFICO.neutro} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por tipo</p>
        <Pizza dados={porTipo} cores={(_, i) => CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por prioridade</p>
        {porPrioridade.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, porPrioridade.length * 30)}>
            <BarChart data={porPrioridade} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v} chamado${v === 1 ? "" : "s"}`} />
              <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                {porPrioridade.map((d) => (
                  <Cell key={d.label} fill={CORES_PRIORIDADE_GRAFICO[d.label] ?? CORES_GRAFICO.primaria} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
