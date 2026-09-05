"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos (05/09/2026, pedido do Daniel) — distribuição de
// fretes por status + ranking dos motoristas com mais valor em fretes
// concluídos, a partir dos fretes já carregados pela página (RPC
// meus_fretes_empresa, sem query nova).
export type ItemStatusFrete = { label: string; total: number };
export type ItemMotoristaValor = { nome: string; valor: number };

const CORES_STATUS: Record<string, string> = {
  "Em negociação": CORES_GRAFICO.acento,
  "Aceitos/Em andamento": "#0ea5e9",
  Concluídos: "#16a34a",
  "Cancelados/Recusados": "#dc2626",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoFretes({
  porStatus,
  topMotoristas,
}: {
  porStatus: ItemStatusFrete[];
  topMotoristas: ItemMotoristaValor[];
}) {
  const comStatus = porStatus.filter((s) => s.total > 0);
  if (comStatus.length === 0 && topMotoristas.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Fretes por status</p>
        {comStatus.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={comStatus} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {comStatus.map((d) => (
                      <Cell key={d.label} fill={CORES_STATUS[d.label] ?? CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} frete${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {comStatus.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: CORES_STATUS[d.label] ?? CORES_GRAFICO.neutro }}
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
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Motoristas com mais valor em fretes concluídos</p>
        {topMotoristas.length === 0 ? (
          <p className="text-sm text-slate-400">Sem fretes concluídos ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, topMotoristas.length * 30)}>
            <BarChart data={topMotoristas} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Valor" fill={CORES_GRAFICO.primaria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
