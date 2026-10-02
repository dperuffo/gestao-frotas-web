"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { formatarNomeEixoGrafico } from "@/lib/formatarNomeEixoGrafico";
import { formatarDataBr } from "@/lib/utils";

// Fase 4 PDV (02/10/2026) — dashboard de acompanhamento do piloto
// controlado (ver Arquitetura_Solucao_PDV.docx, seção da Fase 4): volume
// diário (total vs. confirmado) e ranking de revendas, a partir do que a
// RPC metricas_pdv_dashboard já agregou no servidor (sem query extra aqui).
export type ItemSerieDiaria = { dia: string; total: number; confirmados: number };
export type ItemRevenda = { revenda_empresa_id: string; nome_revenda: string; total: number; confirmados: number; negados: number; valor_total: number };

export function GraficoPdvMetricas({
  serieDiaria,
  porRevenda,
}: {
  serieDiaria: ItemSerieDiaria[];
  porRevenda: ItemRevenda[];
}) {
  if (serieDiaria.length === 0 && porRevenda.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
          Abastecimentos por dia (total vs. confirmado)
        </p>
        {serieDiaria.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={serieDiaria} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 10 }}
                tickFormatter={(d: string) => formatarDataBr(d)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={(d: string) => formatarDataBr(d)} />
              <Line type="monotone" dataKey="total" name="Total" stroke={CORES_GRAFICO.neutro} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="confirmados" name="Confirmados" stroke={CORES_GRAFICO.acento} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
          Volume por revenda (confirmados)
        </p>
        {porRevenda.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, porRevenda.length * 36)}>
            <BarChart
              data={porRevenda}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="nome_revenda"
                width={170}
                tick={{ fontSize: 10 }}
                tickFormatter={(nome: string) => formatarNomeEixoGrafico(nome)}
                interval={0}
              />
              <Tooltip labelFormatter={(nome: string) => nome} />
              <Bar dataKey="confirmados" name="Confirmados" fill={CORES_GRAFICO.acento} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
