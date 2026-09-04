"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — ranking de GASTO (combustível +
// manutenção, últimos 90 dias, via RPC centros_custo_gasto_resumo) por
// centro de custo + pizza ativo/inativo.
export type ItemCentroCusto = { nome: string; veiculos: number; ativo: boolean };
export type ItemGastoCentroCusto = { nome: string; gasto_combustivel: number; gasto_manutencao: number; gasto_total: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoCentrosCusto({
  centros,
  gastoPorCentro,
}: {
  centros: ItemCentroCusto[];
  gastoPorCentro: ItemGastoCentroCusto[];
}) {
  const rankingGasto = [...gastoPorCentro]
    .filter((c) => c.gasto_total > 0)
    .sort((a, b) => b.gasto_total - a.gasto_total)
    .slice(0, 8)
    .reverse();

  const ativos = centros.filter((c) => c.ativo).length;
  const distribuicaoStatus = [
    { label: "Ativo", total: ativos },
    { label: "Inativo", total: centros.length - ativos },
  ].filter((d) => d.total > 0);

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">
          Gasto por centro de custo — últimos 90 dias {gastoPorCentro.length > 8 ? "(top 8)" : ""}
        </p>
        {rankingGasto.length === 0 ? (
          <p className="text-sm text-slate-400">Sem abastecimento ou manutenção registrado no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, rankingGasto.length * 28)}>
            <BarChart data={rankingGasto} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="gasto_total" name="Gasto" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Status dos centros de custo</p>
        {distribuicaoStatus.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribuicaoStatus} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {distribuicaoStatus.map((d, i) => (
                      <Cell key={d.label} fill={i === 0 ? CORES_GRAFICO.serie[3] : CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} centro${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {distribuicaoStatus.map((d, i) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: i === 0 ? CORES_GRAFICO.serie[3] : CORES_GRAFICO.neutro }}
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
    </div>
  );
}
