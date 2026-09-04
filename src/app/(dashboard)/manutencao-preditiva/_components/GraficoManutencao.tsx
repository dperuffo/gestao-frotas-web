"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GaugeIndicador } from "../../indicadores-frota/_components/GaugeIndicador";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — gauge de score médio (mesma
// faixa de cor 70/40 já usada em corBarraScore/ScoreBar) + pizza da
// distribuição Crítico/Alerta/OK (kpis já calculados por
// manutencao_preditiva_kpis, sem query nova) + ranking dos veículos mais
// críticos da página carregada (menor score primeiro).
export type ItemRankingScore = { placa: string; score: number };

const COR_CRITICO = "#dc2626";
const COR_ALERTA = "#d97706";
const COR_OK = "#16a34a";

export function GraficoManutencao({
  scoreMedio,
  totalCriticos,
  totalAlertas,
  totalOk,
  ranking,
}: {
  scoreMedio: number;
  totalCriticos: number;
  totalAlertas: number;
  totalOk: number;
  ranking: ItemRankingScore[];
}) {
  const distribuicao = [
    { label: "Crítico", total: totalCriticos, cor: COR_CRITICO },
    { label: "Alerta", total: totalAlertas, cor: COR_ALERTA },
    { label: "OK", total: totalOk, cor: COR_OK },
  ].filter((d) => d.total > 0);

  const pioresPrimeiro = [...ranking].sort((a, b) => a.score - b.score).slice(0, 8).reverse();

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <GaugeIndicador
        label="Score médio da frota"
        valor={Math.round(scoreMedio)}
        min={0}
        max={100}
        zonaVermelha={40}
        zonaVerde={70}
        unidade="numero"
        ajudaChave="manutencao.proxima_prevista"
      />

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Distribuição por status</p>
        {distribuicao.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribuicao} dataKey="total" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {distribuicao.map((d) => (
                      <Cell key={d.label} fill={d.cor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} veículo${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {distribuicao.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.cor }} aria-hidden="true" />
                  <span className="text-slate-600">{d.label}</span>
                  <span className="font-medium text-slate-900">{d.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Veículos mais críticos (menor score)</p>
        {pioresPrimeiro.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, pioresPrimeiro.length * 28)}>
            <BarChart data={pioresPrimeiro} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="placa" width={70} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `Score ${v}`} />
              <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]}>
                {pioresPrimeiro.map((item) => (
                  <Cell key={item.placa} fill={item.score >= 70 ? COR_OK : item.score >= 40 ? COR_ALERTA : COR_CRITICO} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
