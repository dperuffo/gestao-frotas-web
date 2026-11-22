"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BlocoVisual } from "@/lib/assistenteIA";
import { formatarValor } from "@/lib/assistenteFormato";

export { formatarValor };

// Desenha o gráfico/tabela que o Assistente FNI pediu (ferramenta
// exibir_grafico). Os dados já vêm validados do servidor.
const CORES = ["#0ea5e9", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899", "#64748b"];

export function BlocoVisualAssistente({ bloco }: { bloco: BlocoVisual }) {
  const dados = bloco.categorias.map((cat, i) => {
    const linha: Record<string, string | number> = { categoria: cat };
    bloco.series.forEach((sr) => {
      linha[sr.nome] = sr.valores[i];
    });
    return linha;
  });
  const fmt = (v: number) => formatarValor(Number(v), bloco.formato);
  const tickStyle = { fontSize: 11, fill: "currentColor" };

  return (
    <div className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <p className="mb-2 text-xs font-semibold text-slate-800 dark:text-slate-100">{bloco.titulo}</p>

      {bloco.tipo === "tabela" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left dark:border-slate-600">
                <th className="py-1 pr-3 font-medium">Item</th>
                {bloco.series.map((sr) => (
                  <th key={sr.nome} className="py-1 pr-3 text-right font-medium">
                    {sr.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.categorias.map((cat, i) => (
                <tr key={`${cat}-${i}`} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                  <td className="py-1 pr-3">{cat}</td>
                  {bloco.series.map((sr) => (
                    <td key={sr.nome} className="py-1 pr-3 text-right tabular-nums">
                      {fmt(sr.valores[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ width: "100%", height: bloco.tipo === "barras" && bloco.categorias.length > 6 ? 320 : 260 }}>
          <ResponsiveContainer>
            {bloco.tipo === "pizza" ? (
              <PieChart>
                <Pie data={dados} dataKey={bloco.series[0].nome} nameKey="categoria" outerRadius={90} label={false}>
                  {dados.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            ) : bloco.tipo === "linhas" ? (
              <LineChart data={dados} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} />
                <XAxis dataKey="categoria" tick={tickStyle} />
                <YAxis tick={tickStyle} tickFormatter={(v) => fmt(Number(v))} width={80} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                {bloco.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {bloco.series.map((sr, i) => (
                  <Line key={sr.nome} type="monotone" dataKey={sr.nome} stroke={CORES[i % CORES.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            ) : (
              // Barras horizontais: nomes longos (placas, postos) ficam legíveis.
              <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} />
                <XAxis type="number" tick={tickStyle} tickFormatter={(v) => fmt(Number(v))} />
                <YAxis type="category" dataKey="categoria" tick={tickStyle} width={110} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                {bloco.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {bloco.series.map((sr, i) => (
                  <Bar key={sr.nome} dataKey={sr.nome} fill={CORES[i % CORES.length]} radius={[0, 4, 4, 0]} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
