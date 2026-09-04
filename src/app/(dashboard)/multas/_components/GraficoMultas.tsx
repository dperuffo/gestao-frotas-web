"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { STATUS_MULTA_LABEL } from "@/lib/multas";

// Fase Plano-Graficos Onda 1 (04/09/2026) — status (funil simplificado em
// barras), ranking de valor por motorista e série temporal mensal de valor,
// tudo a partir do multasRaw já carregado (sem query nova).
export type ItemStatus = { status: string; total: number };
export type ItemRankingMotorista = { motorista: string; valor: number };
export type ItemValorMes = { mes: string; valor: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoMultas({
  porStatus,
  rankingMotorista,
  valorPorMes,
}: {
  porStatus: ItemStatus[];
  rankingMotorista: ItemRankingMotorista[];
  valorPorMes: ItemValorMes[];
}) {
  const statusOrdenado = [...porStatus].sort((a, b) => b.total - a.total);

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Multas por status</p>
        {statusOrdenado.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, statusOrdenado.length * 30)}>
            <BarChart data={statusOrdenado} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="status"
                width={110}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => STATUS_MULTA_LABEL[v] ?? v}
              />
              <Tooltip formatter={(v: number) => `${v} multa${v === 1 ? "" : "s"}`} labelFormatter={(l: string) => STATUS_MULTA_LABEL[l] ?? l} />
              <Bar dataKey="total" name="Total" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]}>
                {statusOrdenado.map((s) => (
                  <Cell key={s.status} fill={s.status === "paga" ? "#16a34a" : s.status === "cancelada" ? CORES_GRAFICO.neutro : CORES_GRAFICO.acento} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Valor por motorista (top 8)</p>
        {rankingMotorista.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, rankingMotorista.length * 28)}>
            <BarChart data={rankingMotorista} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="motorista" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Valor" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Valor de multas por mês</p>
        {valorPorMes.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={valorPorMes} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Valor" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
