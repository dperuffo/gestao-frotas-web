"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — situação da frota (pizza) +
// ranking de maior depreciação acumulada, tudo a partir do veiculos já
// carregado pela página (sem query nova).
export type ItemDistribuicao = { label: string; total: number };
export type ItemRankingDepreciacao = { placa: string; depreciacao: number };

const CORES_SITUACAO: Record<string, string> = {
  "Em depreciação": "#16a34a",
  "Vida útil esgotada": "#d97706",
  Baixado: CORES_GRAFICO.neutro,
  "Sem aquisição": "#dc2626",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoPatrimonio({
  porSituacao,
  rankingDepreciacao,
}: {
  porSituacao: ItemDistribuicao[];
  rankingDepreciacao: ItemRankingDepreciacao[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Situação da frota</p>
        {porSituacao.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porSituacao} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {porSituacao.map((d) => (
                      <Cell key={d.label} fill={CORES_SITUACAO[d.label] ?? CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} veículo${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {porSituacao.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: CORES_SITUACAO[d.label] ?? CORES_GRAFICO.neutro }}
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
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Maior depreciação acumulada (top 8)</p>
        {rankingDepreciacao.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, rankingDepreciacao.length * 28)}>
            <BarChart data={rankingDepreciacao} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="placa" width={70} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="depreciacao" name="Depreciação" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
