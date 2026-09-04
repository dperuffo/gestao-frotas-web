"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos Onda 1 (04/09/2026) — distribuição por tipo/gravidade
// + série temporal de custo mensal, tudo a partir do sinistrosRaw já
// carregado pela página (nenhuma query nova).
export type ItemDistribuicao = { label: string; total: number };
export type ItemCustoMes = { mes: string; custo: number };

const GRAVIDADE_CORES: Record<string, string> = {
  Leve: "#16a34a",
  Moderada: "#d97706",
  Grave: "#dc2626",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Pizza({ dados, cores }: { dados: ItemDistribuicao[]; cores: (i: number) => string }) {
  if (dados.length === 0) return <p className="text-sm text-slate-400">Sem dados.</p>;
  return (
    <div className="flex items-center gap-4">
      <div style={{ width: 110, height: 110 }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="total" nameKey="label" innerRadius={28} outerRadius={52} paddingAngle={2}>
              {dados.map((d, i) => (
                <Cell key={d.label} fill={cores(i)} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => `${v} sinistro${v === 1 ? "" : "s"}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1 text-sm">
        {dados.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cores(i) }} aria-hidden="true" />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-medium text-slate-900">{d.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GraficoSinistros({
  porTipo,
  porGravidade,
  custoPorMes,
}: {
  porTipo: ItemDistribuicao[];
  porGravidade: ItemDistribuicao[];
  custoPorMes: ItemCustoMes[];
}) {
  return (
    <div className="card mb-6 grid gap-6 p-5 lg:grid-cols-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por tipo</p>
        <Pizza dados={porTipo} cores={(i) => CORES_GRAFICO.serie[i % CORES_GRAFICO.serie.length]} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Por gravidade</p>
        <Pizza dados={porGravidade} cores={(i) => GRAVIDADE_CORES[porGravidade[i]?.label] ?? CORES_GRAFICO.neutro} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">Custo estimado por mês</p>
        {custoPorMes.length === 0 ? (
          <p className="text-sm text-slate-400">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={custoPorMes} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Bar dataKey="custo" name="Custo" fill={CORES_GRAFICO.primaria} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
