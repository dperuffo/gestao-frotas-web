"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — status (pizza) + categoria
// (pizza) + valor por categoria (barras), calculados a partir de uma
// amostra recente (até 500 registros) já que a tabela é paginada e não
// representaria o todo.
export type ItemDistribuicao = { label: string; total: number };
export type ItemValorCategoria = { label: string; valor: number };

const CORES_STATUS_GRAFICO: Record<string, string> = {
  Pendente: "#d97706",
  Aprovada: "#16a34a",
  Reprovada: "#dc2626",
  Executada: "#0ea5e9",
  Cancelada: CORES_GRAFICO.neutro,
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
            <Tooltip formatter={(v: number) => `${v} solicitação${v === 1 ? "" : "ões"}`} />
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

export function GraficoAprovacoes({
  porStatus,
  porCategoria,
  valorPorCategoria,
}: {
  porStatus: ItemDistribuicao[];
  porCategoria: ItemDistribuicao[];
  valorPorCategoria: ItemValorCategoria[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por status (amostra recente)</p>
        <Pizza dados={porStatus} cores={(label) => CORES_STATUS_GRAFICO[label] ?? CORES_GRAFICO.neutro} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por categoria</p>
        <Pizza dados={porCategoria} cores={(_, i) => CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Valor por categoria</p>
        {valorPorCategoria.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, valorPorCategoria.length * 30)}>
            <BarChart data={valorPorCategoria} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Valor" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
