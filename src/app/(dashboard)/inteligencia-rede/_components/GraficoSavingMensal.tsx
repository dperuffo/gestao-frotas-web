"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoEvolucaoMensal = { mes: string; combustivel: string; precoMedio: number };

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function formatarMesLabel(mes: string) {
  const [ano, mesNum] = mes.split("-");
  return new Date(Number(ano), Number(mesNum) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

// Evolução mensal do preço médio GF, com opção de olhar "Todos" (média
// simples entre combustíveis, sempre em azul, sem referência) ou um
// combustível específico (barras verdes/vermelhas conforme abaixo/acima da
// referência ANP daquele combustível) — mesmo comportamento do painel
// "Saving Mensal Acumulado" do Streamlit.
export function GraficoSavingMensal({
  dados,
  referencias,
}: {
  dados: PontoEvolucaoMensal[];
  referencias: Record<string, number>;
}) {
  const combustiveis = useMemo(() => Array.from(new Set(dados.map((d) => d.combustivel))).sort(), [dados]);
  const [selecionado, setSelecionado] = useState("Todos");

  const referenciaAtual = selecionado !== "Todos" ? (referencias[selecionado] ?? null) : null;

  const serie = useMemo(() => {
    const porMes = new Map<string, number[]>();
    for (const d of dados) {
      if (selecionado !== "Todos" && d.combustivel !== selecionado) continue;
      if (!porMes.has(d.mes)) porMes.set(d.mes, []);
      porMes.get(d.mes)!.push(d.precoMedio);
    }
    return Array.from(porMes.entries())
      .map(([mes, precos]) => ({
        mes,
        mesLabel: formatarMesLabel(mes),
        precoMedio: precos.reduce((soma, v) => soma + v, 0) / precos.length,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [dados, selecionado]);

  const savingAcumulado =
    referenciaAtual != null ? serie.reduce((soma, p) => soma + (referenciaAtual - p.precoMedio), 0) : null;

  if (dados.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Histórico de preços vazio. Reenvie a planilha de preços periodicamente para construir a série mensal.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs font-medium text-slate-500">Combustível:</label>
        <select value={selecionado} onChange={(e) => setSelecionado(e.target.value)} className="input w-auto text-sm">
          <option value="Todos">Todos</option>
          {combustiveis.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {serie.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Sem histórico para esse combustível.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              {referenciaAtual != null && (
                <ReferenceLine
                  y={referenciaAtual}
                  stroke="#E65100"
                  strokeDasharray="4 4"
                  label={{ value: `ANP: ${formatarMoeda(referenciaAtual)}`, position: "insideTopLeft", fontSize: 11, fill: "#E65100" }}
                />
              )}
              <Bar dataKey="precoMedio" name="Preço médio GF" radius={[4, 4, 0, 0]}>
                {serie.map((p) => (
                  <Cell
                    key={p.mes}
                    fill={referenciaAtual == null ? "#1565C0" : p.precoMedio < referenciaAtual ? "#2E7D32" : "#B71C1C"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {savingAcumulado != null && (
            <div className="mt-3 rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
              Saldo acumulado do período:{" "}
              <strong className={savingAcumulado > 0 ? "text-status-ativo" : "text-red-600"}>
                {formatarMoeda(Math.abs(savingAcumulado))}/L
              </strong>{" "}
              (rede GF {savingAcumulado > 0 ? "abaixo" : "acima"} do ANP em média)
            </div>
          )}
        </>
      )}
    </div>
  );
}
