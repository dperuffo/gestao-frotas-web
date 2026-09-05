"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { formatarMoeda } from "@/lib/financeiro";
import { statusDoValor } from "./GaugeIndicador";

// Fase Plano-Graficos (05/09/2026, pedido do Daniel) — km com carga vs vazio
// (estimado) + Receita/Custo/Investimento lado a lado, a partir do mesmo
// objeto `operacionais` (RPC kpis_operacionais_frota) já carregado na
// página — sem query nova.
//
// Os gauges de "Km rodado vazio" e "ROI da frota" foram removidos de
// page.tsx (pedido do Daniel: remover os velocímetros já refletidos nos
// gráficos novos) — os selos Crítico/Atenção/Bom migraram pra cá, com os
// mesmos limiares dos gauges originais (km vazio: invertido, 40/20; ROI:
// não invertido, 0/15).

export function GraficoKmVazioRoi({
  kmComCarga,
  kmVazio,
  kmVazioPct,
  receita,
  custo,
  investimento,
  roiPct,
}: {
  kmComCarga: number;
  kmVazio: number;
  kmVazioPct: number | null;
  receita: number;
  custo: number;
  investimento: number;
  roiPct: number | null;
}) {
  const statusKmVazio = kmVazioPct !== null ? statusDoValor(kmVazioPct, 40, 20, true) : null;
  const statusRoi = roiPct !== null ? statusDoValor(roiPct, 0, 15, false) : null;
  const dadosKm = [
    { label: "Km com carga (estimado)", valor: Math.round(kmComCarga), cor: CORES_GRAFICO.primaria },
    { label: "Km vazio (estimado)", valor: Math.round(kmVazio), cor: CORES_GRAFICO.acento },
  ].filter((d) => d.valor > 0);

  const dadosFinanceiro = [
    { label: "Receita bruta", valor: receita },
    { label: "Custo operacional", valor: custo },
    { label: "Investido na frota", valor: investimento },
  ].filter((d) => d.valor > 0);

  if (dadosKm.length === 0 && dadosFinanceiro.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-medium uppercase text-slate-500">Km rodado — com carga vs vazio (estimado)</p>
          {kmVazioPct !== null && (
            <span className="text-xs font-semibold text-slate-700">
              {kmVazioPct}%
              {statusKmVazio && (
                <span
                  className="ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: statusKmVazio.corFundo, color: statusKmVazio.corTexto }}
                >
                  {statusKmVazio.texto}
                </span>
              )}
            </span>
          )}
        </div>
        {dadosKm.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados de km no período.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div style={{ width: 120, height: 120 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dadosKm} dataKey="valor" nameKey="label" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {dadosKm.map((d) => (
                      <Cell key={d.label} fill={d.cor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString("pt-BR")} km`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {dadosKm.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.cor }} aria-hidden="true" />
                  <span className="text-slate-600">{d.label}</span>
                  <span className="font-medium text-slate-900">{d.valor.toLocaleString("pt-BR")} km</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-xs font-medium uppercase text-slate-500">Receita, custo e investimento</p>
          {roiPct !== null && (
            <span className="text-xs font-semibold text-slate-700">
              ROI {roiPct}%
              {statusRoi && (
                <span
                  className="ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: statusRoi.corFundo, color: statusRoi.corTexto }}
                >
                  {statusRoi.texto}
                </span>
              )}
            </span>
          )}
        </div>
        {dadosFinanceiro.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados financeiros no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dadosFinanceiro} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                {dadosFinanceiro.map((d, i) => (
                  <Cell key={d.label} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
