"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 3 (04/09/2026) — pizza combustível/manutenção/
// custos fixos + ranking de combustível por meio de pagamento, a partir dos
// indicadores e indicadoresPorProvedor já carregados pela página (sem query
// nova).
export type ItemCategoria = { label: string; total: number };
export type ItemProvedor = { provedor: string; custo: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoResumoFinanceiro({
  categorias,
  porProvedor,
}: {
  categorias: ItemCategoria[];
  porProvedor: ItemProvedor[];
}) {
  const comDados = categorias.filter((c) => c.total > 0);
  if (comDados.length === 0 && porProvedor.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Custo do mês por categoria</p>
        {comDados.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no mês.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div style={{ width: 140, height: 140 }} className="mx-auto shrink-0 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={comDados} dataKey="total" nameKey="label" innerRadius={38} outerRadius={62} paddingAngle={2}>
                    {comDados.map((c, i) => (
                      <Cell key={c.label} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {comDados.map((c, i) => (
                <li key={c.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length] }}
                      aria-hidden="true"
                    />
                    {c.label}
                  </span>
                  <span className="whitespace-nowrap font-medium text-slate-900">{formatarMoeda(c.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Combustível por meio de pagamento</p>
        {porProvedor.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no mês.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, porProvedor.length * 30)}>
            <BarChart data={porProvedor} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="provedor" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="custo" name="Custo combustível" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
