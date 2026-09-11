"use client";

import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { LogoProvedor } from "@/components/LogoProvedor";
import { formatarNomeEixoGrafico } from "@/lib/formatarNomeEixoGrafico";

// Fase Plano-Graficos (04/09/2026, pedido do Daniel) — gráficos das duas
// abas de /conferencia-precos, a partir dos dados já carregados pela
// página (RPCs *_divergencias_preco / *_extrato_diario, sem query nova).

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type ItemProvedorContagem = { provedor: string; total: number };
export type ItemContraparteImpacto = { nome: string; impacto: number };

export function GraficoDivergencias({
  porProvedor,
  topImpacto,
  tituloRanking,
}: {
  porProvedor: ItemProvedorContagem[];
  topImpacto: ItemContraparteImpacto[];
  tituloRanking: string;
}) {
  // Fase Dark-Mode — mesmo padrão de GraficoPrevisaoConsumo.tsx.
  const { resolvedTheme } = useTheme();
  const corEixo = resolvedTheme === "dark" ? "#94A3B8" : "#64748B";
  const corGrade = resolvedTheme === "dark" ? "#334155" : CORES_GRAFICO.grade;
  const tooltipStyle =
    resolvedTheme === "dark" ? { backgroundColor: "#1e293b", borderColor: "#334155", color: "#f1f5f9" } : undefined;

  if (porProvedor.length === 0 && topImpacto.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Divergências por meio de pagamento</p>
        {porProvedor.length === 0 ? (
          <p className="text-sm text-slate-400">Sem divergências no período.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div style={{ width: 130, height: 130 }} className="mx-auto shrink-0 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porProvedor} dataKey="total" nameKey="provedor" innerRadius={34} outerRadius={58} paddingAngle={2}>
                    {porProvedor.map((p, i) => (
                      <Cell key={p.provedor} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} divergência${v === 1 ? "" : "s"}`} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {porProvedor.map((p) => (
                <li key={p.provedor} className="flex items-center justify-between gap-3">
                  <LogoProvedor provedor={p.provedor} className="h-4 w-auto" />
                  <span className="whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">{p.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{tituloRanking}</p>
        {topImpacto.length === 0 ? (
          <p className="text-sm text-slate-400">Sem divergências no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, topImpacto.length * 36)}>
            <BarChart
              data={topImpacto}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
              <XAxis type="number" tick={{ fontSize: 11, fill: corEixo }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis
                type="category"
                dataKey="nome"
                width={160}
                tick={{ fontSize: 11, fill: corEixo }}
                tickFormatter={(nome: string) => formatarNomeEixoGrafico(nome)}
                interval={0}
              />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} labelFormatter={(nome: string) => nome} contentStyle={tooltipStyle} />
              <Bar dataKey="impacto" name="Impacto" fill="#dc2626" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export type ItemDia = { dia: string; valor: number };

export function GraficoExtratoDiario({
  valorPorDia,
  porProvedor,
}: {
  valorPorDia: ItemDia[];
  porProvedor: ItemProvedorContagem[];
}) {
  // Fase Dark-Mode — mesmo padrão de GraficoPrevisaoConsumo.tsx.
  const { resolvedTheme } = useTheme();
  const corEixo = resolvedTheme === "dark" ? "#94A3B8" : "#64748B";
  const corGrade = resolvedTheme === "dark" ? "#334155" : CORES_GRAFICO.grade;
  const tooltipStyle =
    resolvedTheme === "dark" ? { backgroundColor: "#1e293b", borderColor: "#334155", color: "#f1f5f9" } : undefined;

  const comValor = valorPorDia.some((d) => d.valor > 0);
  if (!comValor && porProvedor.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Valor movimentado por dia</p>
        {!comValor ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={valorPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={corGrade} vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: corEixo }} />
              <YAxis tick={{ fontSize: 11, fill: corEixo }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="valor" name="Valor" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Valor por meio de pagamento</p>
        {porProvedor.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div style={{ width: 130, height: 130 }} className="mx-auto shrink-0 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porProvedor} dataKey="total" nameKey="provedor" innerRadius={34} outerRadius={58} paddingAngle={2}>
                    {porProvedor.map((p, i) => (
                      <Cell key={p.provedor} fill={CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {porProvedor.map((p) => (
                <li key={p.provedor} className="flex items-center justify-between gap-3">
                  <LogoProvedor provedor={p.provedor} className="h-4 w-auto" />
                  <span className="whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">{formatarMoeda(p.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
