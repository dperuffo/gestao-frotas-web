"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 3 (04/09/2026) — distribuição por bandeira +
// preço médio por combustível, a partir dos postos já carregados pela
// página (sem query nova).
export type ItemDistribuicao = { label: string; total: number };
export type ItemPrecoMedio = { combustivel: string; preco: number };

function formatarPreco(valor: number) {
  return `R$ ${valor.toFixed(3)}`;
}

export function GraficoRoteirizacao({
  porBandeira,
  precoMedioPorCombustivel,
}: {
  porBandeira: ItemDistribuicao[];
  precoMedioPorCombustivel: ItemPrecoMedio[];
}) {
  if (porBandeira.length === 0 && precoMedioPorCombustivel.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Postos por bandeira</p>
        {porBandeira.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porBandeira} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {porBandeira.map((d, i) => (
                      <Cell key={d.label} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} posto${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
              {porBandeira.map((d, i) => (
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
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Preço médio por combustível</p>
        {precoMedioPorCombustivel.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, precoMedioPorCombustivel.length * 30)}>
            <BarChart data={precoMedioPorCombustivel} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="combustivel" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarPreco(v)} />
              <Bar dataKey="preco" name="Preço médio" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
