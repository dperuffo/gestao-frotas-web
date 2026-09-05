"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos (05/09/2026, pedido do Daniel: "quero melhorar estes
// gráficos de indicadores" — bloco "Indicadores operacionais (Fretes/TMS)")
// — dois gráficos novos: composição do OTIF (por que o % não é 100 — quanto
// é atraso vs quanto é ocorrência) e evolução mensal dos 4 indicadores
// (OTIF/OCT/avarias/reclamações), usando a nova RPC
// kpis_operacionais_frota_evolucao.

export function GraficoComposicaoOtif({
  noPrazo,
  atrasado,
  comOcorrencia,
}: {
  noPrazo: number;
  atrasado: number;
  comOcorrencia: number;
}) {
  const total = noPrazo + atrasado + comOcorrencia;
  if (total === 0) return null;

  const dados = [
    { label: "No prazo, sem ocorrência", valor: noPrazo, cor: "#16A34A" },
    { label: "Atrasado, sem ocorrência", valor: atrasado, cor: "#F59E0B" },
    { label: "Com ocorrência (avaria/reentrega/devolução/recusa)", valor: comOcorrencia, cor: "#dc2626" },
  ].filter((d) => d.valor > 0);

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">Composição do OTIF</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div style={{ width: 130, height: 130 }} className="mx-auto shrink-0 sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dados} dataKey="valor" nameKey="label" innerRadius={34} outerRadius={58} paddingAngle={2}>
                {dados.map((d) => (
                  <Cell key={d.label} fill={d.cor} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} frete${v === 1 ? "" : "s"}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-1.5 text-sm">
          {dados.map((d) => (
            <li key={d.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.cor }} aria-hidden="true" />
              <span className="text-slate-600">{d.label}</span>
              <span className="ml-auto font-medium text-slate-900">
                {d.valor} ({total > 0 ? Math.round((d.valor / total) * 100) : 0}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export type PontoEvolucaoOperacional = {
  mes: string;
  otifPct: number | null;
  octHoras: number | null;
  avariasPct: number | null;
  reclamacoesPct: number | null;
};

export function GraficoEvolucaoOperacional({ dados }: { dados: PontoEvolucaoOperacional[] }) {
  const comDado = dados.some((d) => d.otifPct !== null || d.octHoras !== null);
  if (!comDado) return null;

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">
        Evolução mensal — OTIF, avarias, reclamações (%) e OCT (horas)
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={dados} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="pct" tick={{ fontSize: 11 }} unit="%" />
          <YAxis yAxisId="horas" orientation="right" tick={{ fontSize: 11 }} unit="h" />
          <Tooltip
            formatter={(v: number, nome: string) => [
              nome === "OCT (h)" ? `${v}h` : `${v}%`,
              nome,
            ]}
          />
          <Bar yAxisId="horas" dataKey="octHoras" name="OCT (h)" fill={CORES_GRAFICO.neutro} radius={[4, 4, 0, 0]} barSize={18} />
          <Line yAxisId="pct" type="monotone" dataKey="otifPct" name="OTIF" stroke="#16A34A" strokeWidth={2} dot={{ r: 2 }} connectNulls />
          <Line yAxisId="pct" type="monotone" dataKey="avariasPct" name="Avarias" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} connectNulls />
          <Line yAxisId="pct" type="monotone" dataKey="reclamacoesPct" name="Reclamações" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
