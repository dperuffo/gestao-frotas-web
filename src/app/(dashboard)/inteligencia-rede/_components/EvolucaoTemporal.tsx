"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RegistroPreco = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  combustivel: string;
  semana: string;
  mes: string;
  preco: number;
};

export type PrecoRealPeriodo = { uf: string; semana: string; mes: string; precoMedio: number; qtd: number };

const CORES_UF = ["#1040a0", "#1565C0", "#1976D2", "#42A5F5", "#90CAF9", "#0b2660", "#071840", "#2979FF", "#448AFF", "#82B1FF"];
const COR_PRECO_REAL = "#E65100";

function formatarMoeda(v: number, casas = 3) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function periodoLabel(data: string, granularidade: "Semanal" | "Mensal") {
  const [ano, mes, dia] = data.split("-");
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return granularidade === "Semanal"
    ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function quantil(valores: number[], q: number) {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + resto * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function media(valores: number[]) {
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
}

function desvioPadraoAmostral(valores: number[]) {
  if (valores.length < 2) return 0;
  const m = media(valores);
  const somaQuad = valores.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(somaQuad / (valores.length - 1));
}

function truncar(texto: string, tamanho: number) {
  return texto.length > tamanho ? `${texto.slice(0, tamanho)}…` : texto;
}

export function EvolucaoTemporal({ registros, precoReal }: { registros: RegistroPreco[]; precoReal: PrecoRealPeriodo[] }) {
  const combustiveis = useMemo(() => Array.from(new Set(registros.map((r) => r.combustivel))).sort(), [registros]);
  const ufs = useMemo(
    () => Array.from(new Set(registros.map((r) => r.uf).filter((v): v is string => !!v))).sort(),
    [registros]
  );

  const [combustivelSel, setCombustivelSel] = useState("Todos");
  const [ufSel, setUfSel] = useState("Todos");
  const [granularidade, setGranularidade] = useState<"Semanal" | "Mensal">("Semanal");
  const chavePeriodo: "semana" | "mes" = granularidade === "Semanal" ? "semana" : "mes";

  const filtrado = useMemo(() => {
    return registros.filter((r) => {
      if (combustivelSel !== "Todos" && r.combustivel !== combustivelSel) return false;
      if (ufSel !== "Todos" && r.uf !== ufSel) return false;
      return !!r.uf;
    });
  }, [registros, combustivelSel, ufSel]);

  // ---- Seção 1: tendência por UF ----
  const tendenciaPorUf = useMemo(() => {
    const mapa = new Map<string, Map<string, { soma: number; qtd: number }>>();
    for (const r of filtrado) {
      const uf = r.uf!;
      const periodo = r[chavePeriodo];
      if (!mapa.has(uf)) mapa.set(uf, new Map());
      const porPeriodo = mapa.get(uf)!;
      const atual = porPeriodo.get(periodo) ?? { soma: 0, qtd: 0 };
      atual.soma += r.preco;
      atual.qtd += 1;
      porPeriodo.set(periodo, atual);
    }
    const totalPorUf = Array.from(mapa.entries()).map(([uf, porPeriodo]) => ({
      uf,
      pontos: Array.from(porPeriodo.entries())
        .map(([periodo, v]) => ({ periodo, precoMedio: v.soma / v.qtd }))
        .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    }));
    return totalPorUf
      .filter((s) => s.pontos.length >= 2)
      .sort((a, b) => b.pontos.length - a.pontos.length)
      .slice(0, 10)
      .sort((a, b) => a.uf.localeCompare(b.uf));
  }, [filtrado, chavePeriodo]);

  const precoRealSerie = useMemo(() => {
    const mapa = new Map<string, { soma: number; qtd: number }>();
    for (const p of precoReal) {
      if (ufSel !== "Todos" && p.uf !== ufSel) continue;
      const periodo = p[chavePeriodo];
      const atual = mapa.get(periodo) ?? { soma: 0, qtd: 0 };
      atual.soma += p.precoMedio * p.qtd;
      atual.qtd += p.qtd;
      mapa.set(periodo, atual);
    }
    return Array.from(mapa.entries())
      .map(([periodo, v]) => ({ periodo, precoReal: v.qtd > 0 ? v.soma / v.qtd : 0 }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [precoReal, ufSel, chavePeriodo]);

  const dadosGraficoTendencia = useMemo(() => {
    const todosPeriodos = new Set<string>();
    for (const s of tendenciaPorUf) for (const p of s.pontos) todosPeriodos.add(p.periodo);
    for (const p of precoRealSerie) todosPeriodos.add(p.periodo);
    return Array.from(todosPeriodos)
      .sort()
      .map((periodo) => {
        const linha: Record<string, string | number> = { periodo, label: periodoLabel(periodo, granularidade) };
        for (const s of tendenciaPorUf) {
          const ponto = s.pontos.find((p) => p.periodo === periodo);
          if (ponto) linha[s.uf] = ponto.precoMedio;
        }
        const real = precoRealSerie.find((p) => p.periodo === periodo);
        if (real) linha["__real"] = real.precoReal;
        return linha;
      });
  }, [tendenciaPorUf, precoRealSerie, granularidade]);

  const insightsTendencia = useMemo(() => {
    const deltas = tendenciaPorUf
      .map((s) => {
        const primeiro = s.pontos[0].precoMedio;
        const ultimo = s.pontos[s.pontos.length - 1].precoMedio;
        return { uf: s.uf, pct: primeiro !== 0 ? ((ultimo - primeiro) / primeiro) * 100 : 0 };
      })
      .sort((a, b) => b.pct - a.pct);
    if (deltas.length === 0) return null;
    return { alta: deltas[0], queda: deltas[deltas.length - 1] };
  }, [tendenciaPorUf]);

  // ---- Seção 2: volatilidade por UF ----
  const volatilidadePorUf = useMemo(() => {
    const mapa = new Map<string, Map<string, { soma: number; qtd: number }>>();
    for (const r of filtrado) {
      const uf = r.uf!;
      const periodo = r[chavePeriodo];
      if (!mapa.has(uf)) mapa.set(uf, new Map());
      const porPeriodo = mapa.get(uf)!;
      const atual = porPeriodo.get(periodo) ?? { soma: 0, qtd: 0 };
      atual.soma += r.preco;
      atual.qtd += 1;
      porPeriodo.set(periodo, atual);
    }
    const linhas = Array.from(mapa.entries())
      .map(([uf, porPeriodo]) => {
        const mediasPeriodo = Array.from(porPeriodo.values()).map((v) => v.soma / v.qtd);
        return { uf, media: media(mediasPeriodo), std: desvioPadraoAmostral(mediasPeriodo), n: mediasPeriodo.length };
      })
      .filter((l) => l.n >= 2)
      .map((l) => ({ ...l, cv: l.media !== 0 ? (l.std / l.media) * 100 : 0 }));

    const stds = linhas.map((l) => l.std);
    const p75 = quantil(stds, 0.75);
    const p50 = quantil(stds, 0.5);

    const porStd = [...linhas]
      .sort((a, b) => b.std - a.std)
      .map((l) => ({ ...l, cor: l.std > p75 ? "#E53935" : l.std > p50 ? "#F57C00" : "#43A047" }));
    const porCv = [...linhas]
      .sort((a, b) => b.cv - a.cv)
      .map((l) => ({ ...l, cor: l.cv > 5 ? "#E53935" : l.cv > 2 ? "#F57C00" : "#43A047" }));

    return { porStd, porCv };
  }, [filtrado, chavePeriodo]);

  // ---- Seção 3: ranking de estabilidade por posto ----
  const rankingPostos = useMemo(() => {
    const mapa = new Map<string, { razaoSocial: string; municipio: string; uf: string; precos: number[] }>();
    for (const r of filtrado) {
      const chave = r.cnpj;
      if (!mapa.has(chave)) {
        mapa.set(chave, { razaoSocial: r.razaoSocial ?? r.cnpj, municipio: r.municipio ?? "—", uf: r.uf ?? "—", precos: [] });
      }
      mapa.get(chave)!.precos.push(r.preco);
    }
    const linhas = Array.from(mapa.entries())
      .map(([cnpj, v]) => {
        const m = media(v.precos);
        const std = desvioPadraoAmostral(v.precos);
        return {
          cnpj,
          razaoSocial: v.razaoSocial,
          municipio: v.municipio,
          uf: v.uf,
          n: v.precos.length,
          media: m,
          std,
          min: Math.min(...v.precos),
          max: Math.max(...v.precos),
          cvPct: m !== 0 ? (std / m) * 100 : 0,
        };
      })
      .filter((l) => l.n >= 3)
      .map((l) => ({ ...l, amplitude: l.max - l.min }))
      .sort((a, b) => a.cvPct - b.cvPct);
    return linhas;
  }, [filtrado]);

  if (registros.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Histórico de preços vazio.</p>;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Combustível:</label>
          <select value={combustivelSel} onChange={(e) => setCombustivelSel(e.target.value)} className="input w-auto text-sm">
            <option value="Todos">Todos</option>
            {combustiveis.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">UF:</label>
          <select value={ufSel} onChange={(e) => setUfSel(e.target.value)} className="input w-auto text-sm">
            <option value="Todos">Todos</option>
            {ufs.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Granularidade:</label>
          <select
            value={granularidade}
            onChange={(e) => setGranularidade(e.target.value as "Semanal" | "Mensal")}
            className="input w-auto text-sm"
          >
            <option value="Semanal">Semanal</option>
            <option value="Mensal">Mensal</option>
          </select>
        </div>
      </div>

      {filtrado.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nenhum dado para os filtros selecionados.</p>
      ) : (
        <>
          <div className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">🗺️ Tendência de preço por UF</h3>
            {tendenciaPorUf.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">
                Dados insuficientes para traçar tendências regionais. São necessários pelo menos 2 períodos por UF.
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={dadosGraficoTendencia} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Legend />
                    {tendenciaPorUf.map((s, idx) => (
                      <Line
                        key={s.uf}
                        type="monotone"
                        dataKey={s.uf}
                        name={s.uf}
                        stroke={CORES_UF[idx % CORES_UF.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    ))}
                    {precoRealSerie.length > 0 && (
                      <Line
                        type="monotone"
                        dataKey="__real"
                        name="💰 Preço real pago (frota)"
                        stroke={COR_PRECO_REAL}
                        strokeWidth={3}
                        strokeDasharray="6 3"
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                {tendenciaPorUf.length >= 10 && (
                  <p className="mt-1 text-xs text-slate-400">Mostrando os 10 estados com mais dados no período.</p>
                )}

                {insightsTendencia && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div
                      className="rounded-lg border-l-4 px-4 py-3 text-sm"
                      style={{
                        backgroundColor: "#fff3f3",
                        borderColor: insightsTendencia.alta.pct > 0 ? "#E53935" : "#43A047",
                      }}
                    >
                      {insightsTendencia.alta.pct > 0 ? "📈" : "📉"} <strong>{insightsTendencia.alta.uf}</strong> — variação de{" "}
                      <strong>
                        {insightsTendencia.alta.pct >= 0 ? "+" : ""}
                        {insightsTendencia.alta.pct.toFixed(1)}%
                      </strong>{" "}
                      no período (maior alta)
                    </div>
                    <div
                      className="rounded-lg border-l-4 px-4 py-3 text-sm"
                      style={{
                        backgroundColor: "#f3fff3",
                        borderColor: insightsTendencia.queda.pct < 0 ? "#43A047" : "#E53935",
                      }}
                    >
                      {insightsTendencia.queda.pct < 0 ? "📉" : "📈"} <strong>{insightsTendencia.queda.uf}</strong> — variação de{" "}
                      <strong>
                        {insightsTendencia.queda.pct >= 0 ? "+" : ""}
                        {insightsTendencia.queda.pct.toFixed(1)}%
                      </strong>{" "}
                      no período (maior queda)
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mb-6">
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">🌊 Volatilidade de preços por UF</h3>
            <p className="mb-3 text-xs text-slate-400">
              Desvio padrão do preço médio {granularidade === "Semanal" ? "semanal" : "mensal"} por estado — quanto maior,
              mais instável o preço na região.
            </p>
            {volatilidadePorUf.porStd.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Dados insuficientes para calcular volatilidade.</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <BarraHorizontal
                  titulo="Desvio padrão por UF"
                  dados={volatilidadePorUf.porStd.map((v) => ({ label: v.uf, valor: v.std, cor: v.cor, texto: formatarMoeda(v.std, 4) }))}
                  eixoX="Desvio padrão (R$/L)"
                />
                <div>
                  <BarraHorizontal
                    titulo="Coeficiente de variação por UF"
                    dados={volatilidadePorUf.porCv.map((v) => ({ label: v.uf, valor: v.cv, cor: v.cor, texto: `${v.cv.toFixed(1)}%` }))}
                    eixoX="Coeficiente de variação (%)"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Coeficiente de variação = desvio padrão / média (%). Verde &lt; 2% · Laranja 2–5% · Vermelho &gt; 5%.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">🏆 Ranking de estabilidade por posto</h3>
            <p className="mb-3 text-xs text-slate-400">
              Postos com histórico de pelo menos 3 registros, ordenados pelo menor coeficiente de variação de preço.
            </p>
            {rankingPostos.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">
                Nenhum posto com 3 ou mais registros ainda. Continue carregando planilhas para acumular histórico.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs font-medium text-slate-600">🥇 Top 10 mais estáveis</p>
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {rankingPostos.slice(0, 10).map((p, i) => {
                    const medalha = ["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`;
                    const [bg, borda] = p.cvPct < 1 ? ["#E8F5E9", "#43A047"] : p.cvPct < 3 ? ["#FFF8E1", "#F57C00"] : ["#FCE4EC", "#E53935"];
                    return (
                      <div key={p.cnpj} className="rounded-lg border p-3 text-xs" style={{ backgroundColor: bg, borderColor: borda }}>
                        <p className="font-semibold text-slate-700">{medalha}</p>
                        <p className="mt-1 font-medium text-slate-800" title={p.razaoSocial}>
                          {truncar(p.razaoSocial, 22)}
                        </p>
                        <p className="text-slate-500">
                          {p.municipio}/{p.uf}
                        </p>
                        <p className="mt-1 font-semibold" style={{ color: borda }}>
                          CV {p.cvPct.toFixed(2)}%
                        </p>
                        <p className="text-slate-500">{formatarMoeda(p.media)} médio</p>
                      </div>
                    );
                  })}
                </div>

                <p className="mb-2 text-xs font-medium text-slate-600">📊 Distribuição de estabilidade (top 20 postos)</p>
                <div className="mb-6">
                  <BarraHorizontal
                    titulo=""
                    dados={rankingPostos.slice(0, 20).map((p) => ({
                      label: `${truncar(p.razaoSocial, 25)} (${p.uf})`,
                      valor: p.cvPct,
                      cor: p.cvPct < 1 ? "#43A047" : p.cvPct < 3 ? "#F57C00" : "#E53935",
                      texto: `${p.cvPct.toFixed(2)}%`,
                    }))}
                    eixoX="Coeficiente de variação (%)"
                  />
                </div>

                <p className="mb-2 text-xs font-medium text-slate-600">📋 Tabela completa de estabilidade</p>
                <div className="max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2 pr-3">Posto</th>
                        <th className="py-2 pr-3">Município</th>
                        <th className="py-2 pr-3">UF</th>
                        <th className="py-2 pr-3">Registros</th>
                        <th className="py-2 pr-3">Preço médio</th>
                        <th className="py-2 pr-3">Desvio padrão</th>
                        <th className="py-2 pr-3">CV (%)</th>
                        <th className="py-2 pr-3">Mínimo</th>
                        <th className="py-2 pr-3">Máximo</th>
                        <th className="py-2">Amplitude</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rankingPostos.map((p) => (
                        <tr key={p.cnpj}>
                          <td className="py-2 pr-3 text-slate-700">{p.razaoSocial}</td>
                          <td className="py-2 pr-3 text-slate-600">{p.municipio}</td>
                          <td className="py-2 pr-3 text-slate-600">{p.uf}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600">{p.n}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(p.media, 4)}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(p.std, 4)}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600">{p.cvPct.toFixed(2)}%</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(p.min, 4)}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(p.max, 4)}</td>
                          <td className="py-2 tabular-nums text-slate-600">{formatarMoeda(p.amplitude, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BarraHorizontal({
  titulo,
  dados,
  eixoX,
}: {
  titulo: string;
  dados: { label: string; valor: number; cor: string; texto: string }[];
  eixoX: string;
}) {
  const maxValor = Math.max(1e-9, ...dados.map((d) => d.valor));
  return (
    <div>
      {titulo && <p className="mb-2 text-xs font-medium text-slate-600">{titulo}</p>}
      <div className="space-y-1.5">
        {dados.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-32 shrink-0 truncate text-slate-600" title={d.label}>
              {d.label}
            </span>
            <div className="h-4 flex-1 rounded bg-slate-100">
              <div
                className="h-4 rounded"
                style={{ width: `${Math.max(2, (d.valor / maxValor) * 100)}%`, backgroundColor: d.cor }}
              />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums text-slate-500">{d.texto}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-right text-[10px] uppercase text-slate-400">{eixoX}</p>
    </div>
  );
}
