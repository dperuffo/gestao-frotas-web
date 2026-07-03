"use client";

import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CORES_GRADE } from "@/lib/scorePosto";
import type { ParadaSugerida } from "@/lib/roteirizacaoAlgoritmo";

function formatarMoeda(v: number, casas = 2) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// 3 gráficos da aba "Custo da Viagem", portados do Streamlit: custo
// acumulado ao longo da rota, nível do tanque (com zona de risco <25%
// destacada) e custo por posto de abastecimento (breakdown em barras).
export function GraficosRota({
  paradas,
  distanciaKm,
  origemLabel,
  destinoLabel,
  capacidadeTanqueL,
  autonomiaKmPorL,
}: {
  paradas: ParadaSugerida[];
  distanciaKm: number;
  origemLabel: string;
  destinoLabel: string;
  capacidadeTanqueL: number;
  autonomiaKmPorL: number;
}) {
  const dadosCusto = useMemo(() => {
    let acumulado = 0;
    const pontos = [{ km: 0, custo: 0, label: `Origem: ${origemLabel}` }];
    for (const p of paradas) {
      acumulado += p.custoAbastecimento;
      pontos.push({ km: Math.round(p.km), custo: Math.round(acumulado * 100) / 100, label: p.label });
    }
    pontos.push({ km: Math.round(distanciaKm), custo: Math.round(acumulado * 100) / 100, label: `Destino: ${destinoLabel}` });
    return pontos;
  }, [paradas, distanciaKm, origemLabel, destinoLabel]);

  const dadosTanque = useMemo(() => {
    const pontos: { km: number; pct: number; label: string; cor: string }[] = [
      { km: 0, pct: 100, label: `Origem: ${origemLabel}`, cor: "#2E7D32" },
    ];
    for (const p of paradas) {
      const cor = CORES_GRADE[p.grade ?? "C"] ?? "#555";
      pontos.push({ km: Math.round(p.km), pct: p.pctChegada, label: `Chegada: ${p.label} (${p.pctChegada.toFixed(0)}%)`, cor });
      pontos.push({
        km: Math.round(p.km),
        pct: p.pctApos,
        label: `Abast. ${p.litrosSugeridos} L → ${p.label} (${p.pctApos.toFixed(0)}%)`,
        cor,
      });
    }
    if (paradas.length > 0 && autonomiaKmPorL > 0 && capacidadeTanqueL > 0) {
      const ultima = paradas[paradas.length - 1];
      const restanteKm = distanciaKm - ultima.km;
      const pctDestino = Math.max(0, ultima.pctApos - (restanteKm / autonomiaKmPorL / capacidadeTanqueL) * 100);
      pontos.push({ km: Math.round(distanciaKm), pct: Math.round(pctDestino * 10) / 10, label: `Destino: ${destinoLabel}`, cor: "#C62828" });
    }
    return pontos;
  }, [paradas, distanciaKm, origemLabel, destinoLabel, capacidadeTanqueL, autonomiaKmPorL]);

  const dadosPorPosto = useMemo(() => {
    if (paradas.length === 0) return [];
    const precos = paradas.map((p) => p.preco);
    const min = Math.min(...precos);
    const max = Math.max(...precos);
    return paradas.map((p, i) => ({
      nome: `#${i + 1} ${p.label.slice(0, 22)}`,
      custo: p.custoAbastecimento,
      litros: p.litrosSugeridos,
      preco: p.preco,
      cor: p.preco === min ? "#1B5E20" : p.preco === max ? "#E65100" : "#2E7D32",
    }));
  }, [paradas]);

  if (paradas.length === 0) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">📈 Custo Acumulado ao Longo da Rota <AjudaIcon chave="roteirizacao.custo_acumulado" /></p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dadosCusto} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8F5E9" />
            <XAxis dataKey="km" tickFormatter={(v) => `${v} km`} fontSize={11} />
            <YAxis tickFormatter={(v) => formatarMoeda(v, 0)} fontSize={11} width={70} />
            <Tooltip
              formatter={(v: number) => formatarMoeda(v)}
              labelFormatter={(_, payload) => (payload?.[0]?.payload?.label as string) ?? ""}
            />
            <Area type="monotone" dataKey="custo" stroke="#1B5E20" fill="#1B5E20" fillOpacity={0.1} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">🛢 Nível do Tanque ao Longo da Rota <AjudaIcon chave="roteirizacao.nivel_tanque" /></p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dadosTanque} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3F2FD" />
            <ReferenceArea y1={0} y2={25} fill="#F44336" fillOpacity={0.07} />
            <ReferenceLine y={25} stroke="#EF5350" strokeDasharray="4 2" label={{ value: "Mín. 25%", fontSize: 10, fill: "#EF5350", position: "right" }} />
            <XAxis dataKey="km" tickFormatter={(v) => `${v} km`} fontSize={11} />
            <YAxis domain={[0, 110]} tickFormatter={(v) => `${v}%`} fontSize={11} width={45} />
            <Tooltip
              formatter={(v: number) => `${v}%`}
              labelFormatter={(_, payload) => (payload?.[0]?.payload?.label as string) ?? ""}
            />
            <Line
              type="stepAfter"
              dataKey="pct"
              stroke="#1565C0"
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; payload?: { cor: string } }) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return <g key={`${cx}-${cy}`} />;
                return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4.5} fill={payload?.cor ?? "#1565C0"} stroke="#fff" strokeWidth={1.5} />;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[11px] text-slate-400">
          🟢 Grade A · 🔵 Grade B · 🟡 Grade C · 🔴 Grade D — cor de cada marcador é a grade do posto onde parou.
        </p>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">🏢 Custo por Posto de Abastecimento <AjudaIcon chave="roteirizacao.custo_por_posto" /></p>
        <ResponsiveContainer width="100%" height={Math.max(180, dadosPorPosto.length * 46 + 40)}>
          <BarChart data={dadosPorPosto} layout="vertical" margin={{ top: 5, right: 60, left: 8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8F5E9" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatarMoeda(v, 0)} fontSize={11} />
            <YAxis type="category" dataKey="nome" width={150} fontSize={11} />
            <Tooltip
              formatter={(v: number, _n, item) => [
                `${formatarMoeda(v)} (${item?.payload?.litros}L @ ${formatarMoeda(item?.payload?.preco, 3)}/L)`,
                "Custo",
              ]}
            />
            <Bar dataKey="custo" radius={[0, 4, 4, 0]}>
              {dadosPorPosto.map((d, i) => (
                <Cell key={i} fill={d.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
