"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemCoberturaRegiao = {
  regiao: string;
  postosGf: number;
  municipiosComGf: number;
  totalMunicipios: number;
  coberturaPct: number;
  estadosComGf: number;
  totalUfs: number;
};

function corPorCobertura(pct: number) {
  if (pct >= 30) return "#2E7D32";
  if (pct >= 10) return "#F57F17";
  return "#B71C1C";
}

export function GraficoCoberturaMacrorregiao({ dados }: { dados: ItemCoberturaRegiao[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Ainda não há postos cadastrados.</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={dados} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="regiao" width={90} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Bar dataKey="coberturaPct" name="Cobertura de municípios" radius={[0, 4, 4, 0]}>
            {dados.map((d) => (
              <Cell key={d.regiao} fill={corPorCobertura(d.coberturaPct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {dados.map((d) => (
          <div key={d.regiao} className="border-t-2 px-2 py-2 text-center" style={{ borderColor: corPorCobertura(d.coberturaPct) }}>
            <p className="text-xs font-semibold text-slate-600">{d.regiao}</p>
            <p className="text-lg font-bold" style={{ color: corPorCobertura(d.coberturaPct) }}>
              {d.coberturaPct.toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400">{d.postosGf} postos</p>
            <p className="text-[11px] text-slate-400">
              {d.estadosComGf}/{d.totalUfs} estados
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
