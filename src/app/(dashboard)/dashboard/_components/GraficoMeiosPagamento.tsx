"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { LogoProvedor } from "@/components/LogoProvedor";

// Fase Dashboard-Redesign (12/08/2026) — pedido do Daniel: mais
// interatividade/visual no dashboard, inspirado em apps de banco (ver
// benchmark de UX). Troca a lista de texto "Meios de pagamento no mês" por
// um gráfico de rosca (recharts, já era dependência do projeto) + legenda
// com a logo de cada provedor (já usada em outras telas via LogoProvedor).
export type FatiaPagamento = { provedor: string; valor: number };

const CORES = ["#0EA5E9", "#0E7490", "#16A34A", "#F59E0B", "#7C3AED", "#DC2626"];

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GraficoMeiosPagamento({ dados }: { dados: FatiaPagamento[] }) {
  if (dados.length === 0) {
    return <p className="text-sm text-slate-400">Nenhum abastecimento registrado neste mês.</p>;
  }
  const total = dados.reduce((soma, d) => soma + d.valor, 0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div style={{ width: 140, height: 140 }} className="mx-auto shrink-0 sm:mx-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="valor" nameKey="provedor" innerRadius={38} outerRadius={62} paddingAngle={2}>
              {dados.map((d, i) => (
                <Cell key={d.provedor} fill={CORES[i % CORES.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(valor: number) => formatarMoeda(valor)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-2 text-sm">
        {dados.map((d, i) => (
          <li key={d.provedor} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: CORES[i % CORES.length] }}
                aria-hidden="true"
              />
              <LogoProvedor provedor={d.provedor} className="h-4 w-auto" />
            </span>
            <span className="whitespace-nowrap font-medium text-slate-700">
              {formatarMoeda(d.valor)}{" "}
              <span className="text-xs font-normal text-slate-400">
                ({total > 0 ? Math.round((d.valor / total) * 100) : 0}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
