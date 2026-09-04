"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { GaugeIndicador } from "@/app/(dashboard)/indicadores-frota/_components/GaugeIndicador";

// Fase Plano-Graficos Onda 1 (04/09/2026) — gauge de % conciliado + fluxo
// mensal de crédito/débito, tudo a partir do lancamentos já carregado pela
// página (sem query nova).
export type ItemFluxoMes = { mes: string; credito: number; debito: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoConciliacao({
  percentualConciliado,
  fluxoPorMes,
}: {
  percentualConciliado: number;
  fluxoPorMes: ItemFluxoMes[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <div className="flex flex-col items-center justify-center">
        <GaugeIndicador
          label="% conciliado"
          valor={percentualConciliado}
          min={0}
          max={100}
          zonaVermelha={40}
          zonaVerde={75}
          unidade="percentual"
          ajudaChave="conciliacao_bancaria.percentual_conciliado"
        />
      </div>

      <div className="lg:col-span-2">
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Fluxo mensal (crédito x débito)</p>
        {fluxoPorMes.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fluxoPorMes} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="credito" name="Crédito" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="debito" name="Débito" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
