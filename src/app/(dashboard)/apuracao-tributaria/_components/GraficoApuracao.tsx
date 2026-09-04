"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — ranking por posto/UF (a partir
// das notas já carregadas do período) + série temporal de crédito nos
// últimos 12 meses (query leve adicional, só data_emissao + v_icms_mono_ret).
export type ItemRanking = { label: string; valor: number };
export type ItemCreditoMes = { mes: string; valor: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function RankingBarras({ dados, titulo, cor }: { dados: ItemRanking[]; titulo: string; cor: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">{titulo}</p>
      {dados.length === 0 ? (
        <p className="text-sm text-slate-400">Sem dados no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(140, dados.length * 28)}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
            <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatarMoeda(v)} />
            <Bar dataKey="valor" name="Crédito" fill={cor} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function GraficoApuracao({
  rankingUf,
  rankingPosto,
  creditoPorMes,
}: {
  rankingUf: ItemRanking[];
  rankingPosto: ItemRanking[];
  creditoPorMes: ItemCreditoMes[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <RankingBarras dados={rankingUf} titulo="Crédito por UF do posto" cor={CORES_GRAFICO.primaria} />
      <RankingBarras dados={rankingPosto} titulo="Crédito por posto (top 8)" cor={CORES_GRAFICO.acento} />

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Crédito por mês (últimos 12)</p>
        {creditoPorMes.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={creditoPorMes} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Crédito" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
