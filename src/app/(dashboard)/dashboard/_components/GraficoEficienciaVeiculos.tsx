"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemEficienciaVeiculo = {
  placa: string;
  marca: string | null;
  modelo: string | null;
  abastecimentos: number;
  kmTotal: number | null;
  kmMedio: number | null;
  mediaKmL: number | null;
  litrosTotal: number;
  precoMedio: number | null;
  custoTotal: number | null;
};

function formatarInt(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function formatarMoeda(v: number, casas = 2) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function quantil(valores: number[], q: number) {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + resto * (sorted[base + 1] - sorted[base]) : sorted[base];
}

// Eficiência real por veículo — km rodado e km/L calculados a partir de
// hodômetros consecutivos reais dos abastecimentos (não de rota planejada).
// KM médio por abastecimento não tem cor (não é ranking de qualidade); já o
// consumo km/L é colorido em tercis (33º/66º percentil da frota inteira)
// para destacar os veículos mais/menos eficientes.
export function GraficoEficienciaVeiculos({ dados }: { dados: ItemEficienciaVeiculo[] }) {
  const comKm = dados.filter((d) => d.kmMedio != null);
  const comKml = dados.filter((d) => d.mediaKmL != null);

  const kmTotalFrota = dados.reduce((s, d) => s + (d.kmTotal ?? 0), 0);
  const mediaKmLFrota = comKml.length ? comKml.reduce((s, d) => s + (d.mediaKmL ?? 0), 0) / comKml.length : null;
  const litrosTotalFrota = dados.reduce((s, d) => s + d.litrosTotal, 0);

  const top15Km = comKm.slice(0, 15);

  const top15Kml = useMemo(() => {
    const q33 = quantil(comKml.map((d) => d.mediaKmL as number), 0.33);
    const q66 = quantil(comKml.map((d) => d.mediaKmL as number), 0.66);
    return [...comKml]
      .sort((a, b) => (b.mediaKmL as number) - (a.mediaKmL as number))
      .slice(0, 15)
      .map((d) => ({
        ...d,
        cor: (d.mediaKmL as number) >= q66 ? "#43A047" : (d.mediaKmL as number) >= q33 ? "#F57C00" : "#E53935",
      }));
  }, [comKml]);

  if (dados.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Sem abastecimentos com placa no período. Conecte a integração PróFrotas ou lance abastecimentos manuais para
        acumular esse histórico.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi label="🚚 Veículos com dados" valor={formatarInt(dados.length)} />
        <MiniKpi label="🛣️ KM total percorrido" valor={`${formatarInt(kmTotalFrota)} km`} />
        <MiniKpi label="⛽ Média km/L frota" valor={mediaKmLFrota != null ? `${mediaKmLFrota.toFixed(1)} km/L` : "—"} />
        <MiniKpi label="🛢️ Total abastecido" valor={`${formatarInt(litrosTotalFrota)} L`} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">🏎️ KM médio por abastecimento — top 15 veículos</p>
          {top15Km.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Sem hodômetro suficiente para calcular km percorrido.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, top15Km.length * 26)}>
              <BarChart data={top15Km} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="placa" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${formatarInt(v)} km`} />
                <Bar dataKey="kmMedio" name="KM médio" fill="#2E7D32" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">⛽ Consumo médio km/L — top 15 veículos</p>
          {top15Kml.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Sem dados suficientes para calcular km/L.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, top15Kml.length * 26)}>
              <BarChart data={top15Kml} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="placa" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)} km/L`} />
                <Bar dataKey="mediaKmL" name="km/L" radius={[0, 4, 4, 0]}>
                  {top15Kml.map((d) => (
                    <Cell key={d.placa} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p className="mb-2 text-xs font-medium text-slate-600">📋 Tabela de eficiência por veículo</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Placa</th>
              <th className="py-2 pr-3">Veículo</th>
              <th className="py-2 pr-3">Abastecimentos</th>
              <th className="py-2 pr-3">KM total</th>
              <th className="py-2 pr-3">Média km/L</th>
              <th className="py-2 pr-3">Total abast. (L)</th>
              <th className="py-2 pr-3">Preço médio</th>
              <th className="py-2">Custo total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.map((d) => (
              <tr key={d.placa}>
                <td className="py-2 pr-3 font-medium text-slate-700">{d.placa}</td>
                <td className="py-2 pr-3 text-slate-600">{[d.marca, d.modelo].filter(Boolean).join(" ") || "—"}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.abastecimentos}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.kmTotal != null ? `${formatarInt(d.kmTotal)} km` : "—"}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.mediaKmL != null ? `${d.mediaKmL.toFixed(1)} km/L` : "—"}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarInt(d.litrosTotal)}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.precoMedio != null ? formatarMoeda(d.precoMedio, 3) : "—"}</td>
                <td className="py-2 tabular-nums text-slate-700">{d.custoTotal != null ? formatarMoeda(d.custoTotal, 0) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniKpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
