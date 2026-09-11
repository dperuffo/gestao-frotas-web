"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CORES_GRAFICO } from "@/lib/coresGrafico";

export type PontoPrevisaoConsumo = {
  diaLabel: string;
  litros: number;
  tipo: "real" | "projetado";
  /** Custo (R$) do dia — real (valor efetivamente gasto) ou projetado (litros projetados × preço médio do período). */
  valor?: number;
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Pedido do Daniel (14/09/2026): além dos litros, mostrar também a
// projeção de CUSTO (R$) no mesmo gráfico — sem criar um gráfico separado.
// Litros continuam a métrica primária (barras, eixo esquerdo); custo entra
// como uma LINHA sobreposta, com eixo secundário à direita (R$), no mesmo
// padrão visual "escuro = realizado / claro/tracejado = projetado" já usado
// nas barras. Duas séries de linha (valorRealLinha / valorProjetadoLinha)
// em vez de uma só, pra poder estilizar o trecho projetado com traço
// pontilhado — o último dia real é duplicado nas duas séries pra linha não
// "quebrar" visualmente na transição.
export function GraficoPrevisaoConsumo({ dados }: { dados: PontoPrevisaoConsumo[] }) {
  if (dados.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem abastecimentos no período selecionado.</p>;
  }

  const ultimoIndiceReal = dados.reduce((acc, d, i) => (d.tipo === "real" ? i : acc), -1);
  const dadosLinha = dados.map((d, i) => {
    const valor = d.valor ?? 0;
    const ehReal = d.tipo === "real";
    const ehPontoDeTransicao = i === ultimoIndiceReal && ultimoIndiceReal >= 0;
    return {
      ...d,
      valorRealLinha: ehReal ? valor : undefined,
      // Inclui o último dia real também na série projetada, só pra servir de
      // âncora e a linha tracejada nascer exatamente onde a linha sólida termina.
      valorProjetadoLinha: !ehReal ? valor : ehPontoDeTransicao ? valor : undefined,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={dadosLinha} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CORES_GRAFICO.grade} />
        <XAxis dataKey="diaLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis yAxisId="litros" tick={{ fontSize: 12 }} label={{ value: "Litros", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94A3B8" }} />
        <YAxis
          yAxisId="custo"
          orientation="right"
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => formatarMoeda(v)}
          label={{ value: "R$", angle: 90, position: "insideRight", fontSize: 11, fill: "#94A3B8" }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null;
            const ponto = payload[0]?.payload as (typeof dadosLinha)[number] | undefined;
            if (!ponto) return null;
            const rotuloTipo = ponto.tipo === "projetado" ? "projetado" : "real";
            return (
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                <p className="mb-1 font-semibold text-slate-700">Dia {label}</p>
                <p className="text-slate-600">
                  Litros ({rotuloTipo}): {ponto.litros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L
                </p>
                <p className="text-slate-600">
                  Custo ({rotuloTipo}): {formatarMoeda(ponto.valor ?? 0)}
                </p>
              </div>
            );
          }}
        />
        <Legend
          payload={[
            { value: "Litros Realizado", type: "square", color: CORES_GRAFICO.primaria },
            { value: "Litros Projetado", type: "square", color: "#D9D9D9" },
            { value: "Custo Realizado", type: "line", color: CORES_GRAFICO.acento },
            { value: "Custo Projetado", type: "line", color: CORES_GRAFICO.acento },
          ]}
        />
        <Bar yAxisId="litros" dataKey="litros" radius={[4, 4, 0, 0]}>
          {dadosLinha.map((d, i) => (
            <Cell key={i} fill={d.tipo === "projetado" ? "#D9D9D9" : CORES_GRAFICO.primaria} />
          ))}
        </Bar>
        <Line
          yAxisId="custo"
          type="monotone"
          dataKey="valorRealLinha"
          name="Custo Realizado"
          stroke={CORES_GRAFICO.acento}
          strokeWidth={2}
          dot={false}
          connectNulls
          legendType="none"
        />
        <Line
          yAxisId="custo"
          type="monotone"
          dataKey="valorProjetadoLinha"
          name="Custo Projetado"
          stroke={CORES_GRAFICO.acento}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
          legendType="none"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
