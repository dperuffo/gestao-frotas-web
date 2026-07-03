"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemTopMunicipio = { municipio: string; uf: string; total: number };

// Barra horizontal — mesmo padrão do Top 5 Postos do Dashboard, mas aqui
// para os 10 municípios com mais postos GF ativados na rede.
export function GraficoTopMunicipios({ dados }: { dados: ItemTopMunicipio[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Ainda não há postos cadastrados.</p>;
  }

  const dadosGrafico = dados.map((d) => ({
    nome: `${d.municipio} / ${d.uf}`,
    postos: d.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 32)}>
      <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
        <YAxis type="category" dataKey="nome" width={170} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v: number) => `${v} postos`} />
        <Bar dataKey="postos" name="Postos GF" fill="#1565C0" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
