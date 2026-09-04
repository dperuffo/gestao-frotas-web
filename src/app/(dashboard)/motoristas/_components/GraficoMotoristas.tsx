"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { GaugeIndicador } from "../../indicadores-frota/_components/GaugeIndicador";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — 3 gauges de CNH vencendo
// (30/60/90 dias) reaproveitando o GaugeIndicador já usado em
// /indicadores-frota, mais a distribuição Ativo/Inativo em pizza. Os
// contadores vêm de queries de contagem já existentes na página (mesmo
// padrão de totalAtivos/totalGeral), então nenhuma tabela nova.
export function GraficoMotoristas({
  totalGeral,
  totalAtivos,
  vencendo30,
  vencendo60,
  vencendo90,
}: {
  totalGeral: number;
  totalAtivos: number;
  vencendo30: number;
  vencendo60: number;
  vencendo90: number;
}) {
  const pctVencendo = (qtd: number) => (totalGeral > 0 ? Math.round((qtd / totalGeral) * 1000) / 10 : 0);
  const distribuicaoStatus = [
    { label: "Ativo", total: totalAtivos },
    { label: "Inativo", total: Math.max(0, totalGeral - totalAtivos) },
  ].filter((d) => d.total > 0);

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-4">
      <GaugeIndicador
        label="CNH vencendo em 30 dias"
        valor={pctVencendo(vencendo30)}
        min={0}
        max={100}
        invertido
        zonaVermelha={15}
        zonaVerde={5}
        unidade="percentual"
        ajudaChave="motoristas.gauge_cnh_30"
      />
      <GaugeIndicador
        label="CNH vencendo em 60 dias"
        valor={pctVencendo(vencendo60)}
        min={0}
        max={100}
        invertido
        zonaVermelha={20}
        zonaVerde={8}
        unidade="percentual"
        ajudaChave="motoristas.gauge_cnh_60"
      />
      <GaugeIndicador
        label="CNH vencendo em 90 dias"
        valor={pctVencendo(vencendo90)}
        min={0}
        max={100}
        invertido
        zonaVermelha={25}
        zonaVerde={10}
        unidade="percentual"
        ajudaChave="motoristas.gauge_cnh_90"
      />
      <div className="flex flex-col justify-center">
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Status da frota de motoristas</p>
        {distribuicaoStatus.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 110, height: 110 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribuicaoStatus} dataKey="total" nameKey="label" innerRadius={30} outerRadius={52} paddingAngle={2}>
                    {distribuicaoStatus.map((d, i) => (
                      <Cell key={d.label} fill={i === 0 ? CORES_GRAFICO.serie[3] : CORES_GRAFICO.neutro} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} motorista${v === 1 ? "" : "s"}`} />
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
