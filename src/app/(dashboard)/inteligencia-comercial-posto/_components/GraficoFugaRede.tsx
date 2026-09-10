"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

// Fase Plano-Graficos-Comercial-Posto (09/09/2026) — barra horizontal da
// queda de participação (p.p.) por cliente, ordenada da maior queda pra
// menor — quem está "fugindo" mais aparece primeiro.
export type ItemFugaRede = { nome: string; queda_participacao_pp: number | null; status: string };

const CORES_STATUS: Record<string, string> = {
  alerta_fuga: "#dc2626",
  atencao: "#d97706",
  estavel: "#16a34a",
  sem_dados_suficientes: "#94a3b8",
};

export function GraficoFugaRede({ dados }: { dados: ItemFugaRede[] }) {
  const comQueda = dados.filter((d) => d.queda_participacao_pp != null && d.queda_participacao_pp > 0);
  if (comQueda.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Nenhum cliente com queda de participação no momento.</p>;
  }

  const top = [...comQueda].sort((a, b) => b.queda_participacao_pp! - a.queda_participacao_pp!).slice(0, 10).reverse();

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">Maiores quedas de participação (p.p.)</p>
      <ResponsiveContainer width="100%" height={Math.max(200, top.length * 32)}>
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}pp`} />
          <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => `${v} p.p.`} />
          <Bar dataKey="queda_participacao_pp" name="Queda" radius={[0, 4, 4, 0]}>
            {top.map((d) => (
              <Cell key={d.nome} fill={CORES_STATUS[d.status] ?? CORES_GRAFICO.primaria} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
