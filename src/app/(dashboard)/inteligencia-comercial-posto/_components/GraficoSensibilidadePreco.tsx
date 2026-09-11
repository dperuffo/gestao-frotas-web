"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";
import { formatarNomeEixoGrafico } from "@/lib/formatarNomeEixoGrafico";

// Fase Plano-Graficos-Comercial-Posto (09/09/2026) — barra horizontal do
// índice de sensibilidade a preço por cliente (top clientes por |índice|),
// cor pelo status já calculado pela RPC.
export type ItemSensibilidadePreco = { nome: string; indice_sensibilidade: number | null; status: string };

const CORES_STATUS: Record<string, string> = {
  sensivel: "#dc2626",
  moderado: "#d97706",
  estavel: "#16a34a",
  dados_insuficientes: "#94a3b8",
};

export function GraficoSensibilidadePreco({ dados }: { dados: ItemSensibilidadePreco[] }) {
  const comIndice = dados.filter((d) => d.indice_sensibilidade != null);
  if (comIndice.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem dados suficientes pra calcular o índice ainda.</p>;
  }

  const top = [...comIndice]
    .sort((a, b) => Math.abs(b.indice_sensibilidade!) - Math.abs(a.indice_sensibilidade!))
    .slice(0, 10)
    .reverse();

  return (
    <div className="card mb-6 p-5">
      <p className="mb-2 text-xs font-medium uppercase text-slate-500">Índice de sensibilidade a preço (top 10)</p>
      <ResponsiveContainer width="100%" height={Math.max(220, top.length * 36)}>
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
          <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="nome"
            width={170}
            tick={{ fontSize: 11 }}
            tickFormatter={(nome: string) => formatarNomeEixoGrafico(nome)}
            interval={0}
          />
          <Tooltip formatter={(v: number) => v.toFixed(2)} labelFormatter={(nome: string) => nome} />
          <Bar dataKey="indice_sensibilidade" name="Índice" radius={[0, 4, 4, 0]}>
            {top.map((d) => (
              <Cell key={d.nome} fill={CORES_STATUS[d.status] ?? CORES_GRAFICO.primaria} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
