"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 3 (04/09/2026) — pizza de vendas por meio de
// pagamento + barras de aging das contas vencidas, a partir dos dados já
// carregados pela página (sem query nova).
export type ItemProvedor = { provedor: string; valor: number };
export type ItemAging = { label: string; valor: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoResumoFinanceiroPosto({
  porProvedor,
  aging,
}: {
  porProvedor: ItemProvedor[];
  aging: ItemAging[];
}) {
  const comAging = aging.filter((a) => a.valor > 0);
  if (porProvedor.length === 0 && comAging.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Vendas por meio de pagamento</p>
        {porProvedor.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div style={{ width: 130, height: 130 }} className="mx-auto shrink-0 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porProvedor} dataKey="valor" nameKey="provedor" innerRadius={34} outerRadius={58} paddingAngle={2}>
                    {porProvedor.map((p, i) => (
                      <Cell key={p.provedor} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {porProvedor.map((p, i) => (
                <li key={p.provedor} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length] }}
                      aria-hidden="true"
                    />
                    {p.provedor}
                  </span>
                  <span className="whitespace-nowrap font-medium text-slate-900">{formatarMoeda(p.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Contas vencidas por faixa de atraso</p>
        {comAging.length === 0 ? (
          <p className="text-sm text-slate-400">Sem contas vencidas.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, comAging.length * 32)}>
            <BarChart data={comAging} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Vencido" fill="#dc2626" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
