"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ItemDesempenhoAtivo = {
  marca: string;
  modelo: string;
  motor: string;
  qtdVeiculos: number;
  kmTotal: number | null;
  litrosTotal: number | null;
  mediaKmL: number | null;
  precoMedioLitro: number | null;
  custoCombustivelTotal: number | null;
  tcoTotal: number | null;
  custoPorKm: number | null;
  scoreManutencaoMedio: number | null;
  qtdCriticos: number;
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
function rotulo(d: { marca: string; modelo: string; motor: string }) {
  return `${d.marca} ${d.modelo}${d.motor !== "Não informado" ? ` (${d.motor})` : ""}`;
}
// Achado real (13/08/2026) — o rótulo completo ("Marca Modelo (Motor)") é
// longo demais pra caber numa linha só no eixo Y dos gráficos horizontais;
// o Recharts quebra a categoria em várias linhas de SVG, que acabam
// invadindo o espaço da barra vizinha (texto "acavalado"). O eixo mostra a
// versão truncada; o nome completo continua disponível no tooltip (hover)
// e na tabela comparativa logo abaixo.
function truncar(texto: string, tamanho: number) {
  return texto.length > tamanho ? `${texto.slice(0, tamanho - 1).trimEnd()}…` : texto;
}

// Desempenho por ativo (marca/modelo/motor) — pedido do Daniel (12/08/2026):
// comparar km/L, R$/L, custo/km (TCO) e score de manutenção agrupado pelas
// características do veículo, não pela placa individual, pra apoiar decisão
// de compra ("vale continuar comprando essa marca/modelo/motor?"). Cada
// grupo já vem calculado no banco (razão de somas, não média de razões —
// mesmo cuidado estatístico do indicador de eficiência por veículo).
export function TabelaDesempenhoPorAtivo({ dados }: { dados: ItemDesempenhoAtivo[] }) {
  const comKml = dados.filter((d) => d.mediaKmL != null);
  const comCustoKm = dados.filter((d) => d.custoPorKm != null);

  const top12Kml = useMemo(() => {
    const q33 = quantil(comKml.map((d) => d.mediaKmL as number), 0.33);
    const q66 = quantil(comKml.map((d) => d.mediaKmL as number), 0.66);
    return [...comKml]
      .sort((a, b) => (b.mediaKmL as number) - (a.mediaKmL as number))
      .slice(0, 12)
      .map((d) => ({
        ...d,
        nome: truncar(rotulo(d), 22),
        nomeCompleto: rotulo(d),
        cor: (d.mediaKmL as number) >= q66 ? "#43A047" : (d.mediaKmL as number) >= q33 ? "#F57C00" : "#E53935",
      }));
  }, [comKml]);

  const top12CustoKm = useMemo(() => {
    // Aqui o "melhor" é o MENOR custo/km — tercis invertidos em relação ao km/L.
    const q33 = quantil(comCustoKm.map((d) => d.custoPorKm as number), 0.33);
    const q66 = quantil(comCustoKm.map((d) => d.custoPorKm as number), 0.66);
    return [...comCustoKm]
      .sort((a, b) => (a.custoPorKm as number) - (b.custoPorKm as number))
      .slice(0, 12)
      .map((d) => ({
        ...d,
        nome: truncar(rotulo(d), 22),
        nomeCompleto: rotulo(d),
        cor: (d.custoPorKm as number) <= q33 ? "#43A047" : (d.custoPorKm as number) <= q66 ? "#F57C00" : "#E53935",
      }));
  }, [comCustoKm]);

  if (dados.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Sem dados suficientes no período — precisa de veículos com marca, modelo e abastecimentos registrados.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi label="🏷️ Combinações marca/modelo/motor" valor={formatarInt(dados.length)} />
        <MiniKpi label="🚚 Veículos considerados" valor={formatarInt(dados.reduce((s, d) => s + d.qtdVeiculos, 0))} />
        <MiniKpi
          label="⛽ Média km/L (todos)"
          valor={comKml.length ? `${(comKml.reduce((s, d) => s + (d.mediaKmL as number), 0) / comKml.length).toFixed(1)} km/L` : "—"}
        />
        <MiniKpi label="🔴 Veículos críticos" valor={formatarInt(dados.reduce((s, d) => s + d.qtdCriticos, 0))} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">⛽ Consumo médio km/L por marca/modelo/motor</p>
          {top12Kml.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Sem dados suficientes para calcular km/L.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, top12Kml.length * 36)}>
              <BarChart data={top12Kml} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 10 }} interval={0} />
                <Tooltip
                  formatter={(v: number) => `${v.toFixed(1)} km/L`}
                  labelFormatter={(_, payload) =>
                    payload && payload[0] ? (payload[0].payload as { nomeCompleto: string }).nomeCompleto : ""
                  }
                />
                <Bar dataKey="mediaKmL" name="km/L" radius={[0, 4, 4, 0]}>
                  {top12Kml.map((d) => (
                    <Cell key={d.nome} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">💰 Custo por km (TCO) por marca/modelo/motor</p>
          {top12CustoKm.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Sem dados suficientes para calcular custo/km.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, top12CustoKm.length * 36)}>
              <BarChart data={top12CustoKm} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 10 }} interval={0} />
                <Tooltip
                  formatter={(v: number) => formatarMoeda(v, 2)}
                  labelFormatter={(_, payload) =>
                    payload && payload[0] ? (payload[0].payload as { nomeCompleto: string }).nomeCompleto : ""
                  }
                />
                <Bar dataKey="custoPorKm" name="Custo/km" radius={[0, 4, 4, 0]}>
                  {top12CustoKm.map((d) => (
                    <Cell key={d.nome} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p className="mb-2 text-xs font-medium text-slate-600">📋 Tabela comparativa</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Marca / Modelo</th>
              <th className="py-2 pr-3">Motor</th>
              <th className="py-2 pr-3">Veículos</th>
              <th className="py-2 pr-3">Média km/L</th>
              <th className="py-2 pr-3">R$/L médio</th>
              <th className="py-2 pr-3">Custo combustível</th>
              <th className="py-2 pr-3">TCO total</th>
              <th className="py-2 pr-3">Custo/km</th>
              <th className="py-2 pr-3">Score manutenção</th>
              <th className="py-2">Críticos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.map((d) => (
              <tr key={`${d.marca}|${d.modelo}|${d.motor}`}>
                <td className="py-2 pr-3 font-medium text-slate-700">
                  {d.marca} {d.modelo}
                </td>
                <td className="py-2 pr-3 text-slate-600">{d.motor}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.qtdVeiculos}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.mediaKmL != null ? `${d.mediaKmL.toFixed(1)} km/L` : "—"}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.precoMedioLitro != null ? formatarMoeda(d.precoMedioLitro, 3) : "—"}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.custoCombustivelTotal != null ? formatarMoeda(d.custoCombustivelTotal, 0) : "—"}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{d.tcoTotal != null ? formatarMoeda(d.tcoTotal, 0) : "—"}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-700">{d.custoPorKm != null ? formatarMoeda(d.custoPorKm, 2) : "—"}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">
                  {d.scoreManutencaoMedio != null ? `${d.scoreManutencaoMedio.toFixed(0)}/100` : "—"}
                </td>
                <td className="py-2 tabular-nums text-slate-600">
                  {d.qtdCriticos > 0 ? <span className="text-red-600">{d.qtdCriticos}</span> : "0"}
                </td>
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
