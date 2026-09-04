"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — pizza do TCO por categoria
// (soma dos veículos já carregados pela tco_frota_resumo, que já retorna
// custo_combustivel/custo_manutencao/etc por linha — nenhuma query nova) +
// ranking dos 10 veículos com maior custo/km.
export type ItemTco = {
  placa: string;
  custo_por_km: number | null;
  custo_combustivel: number;
  custo_manutencao: number;
  custo_multas: number;
  custo_oficinas: number;
  custo_fixos: number;
  custo_depreciacao: number | null;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CORES = CORES_GRAFICO.serie;

export function GraficoTco({ veiculos }: { veiculos: ItemTco[] }) {
  const categorias = [
    { label: "Combustível", total: veiculos.reduce((s, v) => s + v.custo_combustivel, 0) },
    { label: "Manutenção", total: veiculos.reduce((s, v) => s + v.custo_manutencao, 0) },
    { label: "Depreciação", total: veiculos.reduce((s, v) => s + (v.custo_depreciacao ?? 0), 0) },
    { label: "Multas", total: veiculos.reduce((s, v) => s + v.custo_multas, 0) },
    { label: "Oficinas", total: veiculos.reduce((s, v) => s + v.custo_oficinas, 0) },
    { label: "Custos fixos", total: veiculos.reduce((s, v) => s + v.custo_fixos, 0) },
  ].filter((c) => c.total > 0);

  const rankingCustoPorKm = veiculos
    .filter((v) => v.custo_por_km !== null)
    .sort((a, b) => (b.custo_por_km ?? 0) - (a.custo_por_km ?? 0))
    .slice(0, 10)
    .map((v) => ({ placa: v.placa, custo_por_km: v.custo_por_km ?? 0 }))
    .reverse();

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">TCO da frota por categoria</p>
        {categorias.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div style={{ width: 140, height: 140 }} className="mx-auto shrink-0 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categorias} dataKey="total" nameKey="label" innerRadius={38} outerRadius={62} paddingAngle={2}>
                    {categorias.map((c, i) => (
                      <Cell key={c.label} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {categorias.map((c, i) => (
                <li key={c.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CORES[i % CORES.length] }} aria-hidden="true" />
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
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Maior custo/km (top 10)</p>
        {rankingCustoPorKm.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, rankingCustoPorKm.length * 28)}>
            <BarChart data={rankingCustoPorKm} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${v.toFixed(1)}`} />
              <YAxis type="category" dataKey="placa" width={70} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${formatarMoeda(v)}/km`} />
              <Bar dataKey="custo_por_km" name="Custo/km" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
