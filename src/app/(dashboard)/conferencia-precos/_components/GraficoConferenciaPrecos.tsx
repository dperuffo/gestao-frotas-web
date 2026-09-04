"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { LogoProvedor } from "@/components/LogoProvedor";

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
  if (porProvedor.length === 0 && topImpacto.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Divergências por meio de pagamento</p>
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
                  <Tooltip formatter={(v: number) => `${v} divergência${v === 1 ? "" : "s"}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {porProvedor.map((p) => (
                <li key={p.provedor} className="flex items-center justify-between gap-3">
                  <LogoProvedor provedor={p.provedor} className="h-4 w-auto" />
                  <span className="whitespace-nowrap font-medium text-slate-900">{p.total}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">{tituloRanking}</p>
        {topImpacto.length === 0 ? (
          <p className="text-sm text-slate-400">Sem divergências no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, topImpacto.length * 30)}>
            <BarChart data={topImpacto} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v)}`} />
              <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
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
  const comValor = valorPorDia.some((d) => d.valor > 0);
  if (!comValor && porProvedor.length === 0) return null;

  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Valor movimentado por dia</p>
        {!comValor ? (
          <p className="text-sm text-slate-400">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={valorPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="valor" name="Valor" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Valor por meio de pagamento</p>
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
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {porProvedor.map((p) => (
                <li key={p.provedor} className="flex items-center justify-between gap-3">
                  <LogoProvedor provedor={p.provedor} className="h-4 w-auto" />
                  <span className="whitespace-nowrap font-medium text-slate-900">{formatarMoeda(p.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
