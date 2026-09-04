"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { LogoProvedor } from "@/components/LogoProvedor";

// Fase Plano-Graficos Onda 6 (04/09/2026, pedido do Daniel) — gasto por
// meio de pagamento (últimos 6 meses, já calculado pela página a partir da
// RPC indicadores_financeiros_por_provedor) + evolução mensal do gasto com
// combustível (mesma RPC indicadores_financeiros_evolucao já usada em
// /financeiro, reaproveitada aqui com o mesmo período de 6 meses).
export type ItemProvedor = { provedor: string; valor: number };
export type ItemMesCombustivel = { mes: string; valor: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoAbastecimentos({
  porProvedor,
  evolucaoMensal,
}: {
  porProvedor: ItemProvedor[];
  evolucaoMensal: ItemMesCombustivel[];
}) {
  const comEvolucao = evolucaoMensal.some((m) => m.valor > 0);
  if (porProvedor.length === 0 && !comEvolucao) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Gasto por meio de pagamento (6 meses)</p>
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
              {porProvedor.map((p) => (
                <li key={p.provedor} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <LogoProvedor provedor={p.provedor} className="h-4 w-auto" />
                  </span>
                  <span className="whitespace-nowrap font-medium text-slate-900">{formatarMoeda(p.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Evolução do gasto com combustível</p>
        {!comEvolucao ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={evolucaoMensal} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Gasto" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
