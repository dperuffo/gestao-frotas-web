"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — distribuição por status +
// ranking de maior custo/km (top 8), tudo a partir do pneus já carregado
// pela página (sem query nova).
export type ItemDistribuicao = { label: string; total: number };
export type ItemRankingCustoKm = { placa: string; custoKm: number };

const CORES_STATUS: Record<string, string> = {
  "Em uso": "#16a34a",
  Estepe: "#0ea5e9",
  Descartado: CORES_GRAFICO.neutro,
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoPneus({
  porStatus,
  rankingCustoKm,
}: {
  porStatus: ItemDistribuicao[];
  rankingCustoKm: ItemRankingCustoKm[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por status</p>
        {porStatus.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porStatus} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {porStatus.map((d, i) => (
                      <Cell key={d.label} fill={CORES_STATUS[d.label] ?? CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} pneu${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {porStatus.map((d, i) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: CORES_STATUS[d.label] ?? CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length] }}
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
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Maior custo/km (top 8)</p>
        {rankingCustoKm.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados suficientes (km rodado).</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, rankingCustoKm.length * 28)}>
            <BarChart data={rankingCustoKm} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="placa" width={70} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${formatarMoeda(v)}/km`} />
              <Bar dataKey="custoKm" name="Custo/km" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
