"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoSerie = { mes: string; uf: string; combustivel: string; precoMedio: number; qtd: number };
export type PontoVolatilidade = { mes: string; combustivel: string; volatilidade: number; qtd: number };

const CORES_UF = ["#0D47A1", "#B71C1C", "#2E7D32", "#E65100", "#6A1B9A", "#00838F", "#F57F17", "#4E342E"];
const CORES_COMBUSTIVEL = ["#1565C0", "#C62828", "#2E7D32", "#EF6C00", "#6A1B9A", "#00838F"];
const NOMES_MES_COMPLETO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function mesLabel(mes: string) {
  const [ano, m] = mes.split("-");
  return new Date(Number(ano), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function regressaoLinear(pontos: { x: number; y: number }[]) {
  const n = pontos.length;
  if (n < 2) return null;
  const somaX = pontos.reduce((s, p) => s + p.x, 0);
  const somaY = pontos.reduce((s, p) => s + p.y, 0);
  const somaXY = pontos.reduce((s, p) => s + p.x * p.y, 0);
  const somaX2 = pontos.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * somaX2 - somaX * somaX;
  if (denom === 0) return null;
  const slope = (n * somaXY - somaX * somaY) / denom;
  const intercept = (somaY - slope * somaX) / n;
  return { slope, intercept };
}

function corCelula(v: number | null, min: number, max: number) {
  if (v == null) return "#f1f5f9";
  if (max === min) return "#2e7d32";
  const t = (v - min) / (max - min);
  const stops: { t: number; c: [number, number, number] }[] = [
    { t: 0, c: [26, 74, 42] },
    { t: 0.3, c: [46, 125, 50] },
    { t: 0.6, c: [249, 168, 37] },
    { t: 0.85, c: [230, 81, 0] },
    { t: 1, c: [183, 28, 28] },
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      const localT = (t - stops[i].t) / (stops[i + 1].t - stops[i].t || 1);
      const c = stops[i].c.map((v0, idx) => Math.round(v0 + (stops[i + 1].c[idx] - v0) * localT));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(183,28,28)";
}

export function TendenciaSazonalidade({ serie, volatilidade }: { serie: PontoSerie[]; volatilidade: PontoVolatilidade[] }) {
  const combustiveis = useMemo(() => Array.from(new Set(serie.map((s) => s.combustivel))).sort(), [serie]);
  const [selecionado, setSelecionado] = useState("Todos");

  const porMesUf = useMemo(() => {
    const mapa = new Map<string, { soma: number; qtd: number }>();
    for (const s of serie) {
      if (selecionado !== "Todos" && s.combustivel !== selecionado) continue;
      const chave = `${s.mes}__${s.uf}`;
      const atual = mapa.get(chave) ?? { soma: 0, qtd: 0 };
      atual.soma += s.precoMedio * s.qtd;
      atual.qtd += s.qtd;
      mapa.set(chave, atual);
    }
    return Array.from(mapa.entries()).map(([chave, v]) => {
      const [mes, uf] = chave.split("__");
      return { mes, uf, precoMedio: v.qtd > 0 ? v.soma / v.qtd : 0, qtd: v.qtd };
    });
  }, [serie, selecionado]);

  const topUfs = useMemo(() => {
    const totalPorUf = new Map<string, number>();
    for (const p of porMesUf) totalPorUf.set(p.uf, (totalPorUf.get(p.uf) ?? 0) + p.qtd);
    return Array.from(totalPorUf.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([uf]) => uf);
  }, [porMesUf]);

  const seriesPorUf = useMemo(() => {
    return topUfs
      .map((uf, idx) => {
        const pontos = porMesUf.filter((p) => p.uf === uf).sort((a, b) => a.mes.localeCompare(b.mes));
        const primeiroMesTs = pontos.length ? new Date(pontos[0].mes).getTime() : 0;
        const xs = pontos.map((p) => (new Date(p.mes).getTime() - primeiroMesTs) / (1000 * 60 * 60 * 24));
        const reg = pontos.length >= 3 ? regressaoLinear(pontos.map((p, i) => ({ x: xs[i], y: p.precoMedio }))) : null;
        const tendenciaMes = reg ? reg.slope * 30 : 0;
        const media = pontos.length ? pontos.reduce((s, p) => s + p.precoMedio, 0) / pontos.length : 0;
        const minimo = pontos.length ? Math.min(...pontos.map((p) => p.precoMedio)) : 0;
        const maximo = pontos.length ? Math.max(...pontos.map((p) => p.precoMedio)) : 0;
        const variancia = pontos.length ? pontos.reduce((s, p) => s + (p.precoMedio - media) ** 2, 0) / pontos.length : 0;
        const desvio = Math.sqrt(variancia);
        return { uf, cor: CORES_UF[idx % CORES_UF.length], pontos, primeiroMesTs, reg, tendenciaMes, media, minimo, maximo, desvio };
      })
      .filter((s) => s.pontos.length > 0);
  }, [topUfs, porMesUf]);

  const todosMeses = useMemo(() => Array.from(new Set(porMesUf.map((p) => p.mes))).sort(), [porMesUf]);
  const dadosGraficoTendencia = useMemo(
    () =>
      todosMeses.map((mes) => {
        const linha: Record<string, string | number> = { mes, mesLabel: mesLabel(mes) };
        for (const s of seriesPorUf) {
          const ponto = s.pontos.find((p) => p.mes === mes);
          if (ponto) linha[s.uf] = ponto.precoMedio;
          if (s.reg) {
            const dias = (new Date(mes).getTime() - s.primeiroMesTs) / (1000 * 60 * 60 * 24);
            linha[`${s.uf}_tend`] = s.reg.slope * dias + s.reg.intercept;
          }
        }
        return linha;
      }),
    [todosMeses, seriesPorUf]
  );

  const heatmap = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    const linhas = topUfs.map((uf) => {
      const porMesNum = new Map<number, { soma: number; qtd: number }>();
      for (const p of porMesUf) {
        if (p.uf !== uf) continue;
        const mesNum = new Date(p.mes).getUTCMonth();
        const atual = porMesNum.get(mesNum) ?? { soma: 0, qtd: 0 };
        atual.soma += p.precoMedio * p.qtd;
        atual.qtd += p.qtd;
        porMesNum.set(mesNum, atual);
      }
      const valores = Array.from({ length: 12 }, (_, i) => {
        const v = porMesNum.get(i);
        const media = v && v.qtd > 0 ? v.soma / v.qtd : null;
        if (media != null) {
          min = Math.min(min, media);
          max = Math.max(max, media);
        }
        return media;
      });
      return { uf, valores };
    });
    return { linhas, min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
  }, [topUfs, porMesUf]);

  const combustiveisVol = useMemo(() => Array.from(new Set(volatilidade.map((v) => v.combustivel))).sort(), [volatilidade]);
  const mesesVol = useMemo(() => Array.from(new Set(volatilidade.map((v) => v.mes))).sort(), [volatilidade]);
  const dadosVolatilidade = useMemo(
    () =>
      mesesVol.map((mes) => {
        const linha: Record<string, string | number> = { mes, mesLabel: mesLabel(mes) };
        for (const c of combustiveisVol) {
          const ponto = volatilidade.find((v) => v.mes === mes && v.combustivel === c);
          if (ponto) linha[c] = ponto.volatilidade;
        }
        return linha;
      }),
    [mesesVol, combustiveisVol, volatilidade]
  );

  // Insights automáticos
  const globalPorMes = useMemo(() => {
    const mapa = new Map<string, { soma: number; qtd: number }>();
    for (const p of porMesUf) {
      const atual = mapa.get(p.mes) ?? { soma: 0, qtd: 0 };
      atual.soma += p.precoMedio * p.qtd;
      atual.qtd += p.qtd;
      mapa.set(p.mes, atual);
    }
    return Array.from(mapa.entries())
      .map(([mes, v]) => ({ mes, precoMedio: v.qtd > 0 ? v.soma / v.qtd : 0 }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [porMesUf]);

  const n3 = Math.max(1, Math.floor(globalPorMes.length / 3));
  const inicio = globalPorMes.slice(0, n3);
  const fim = globalPorMes.slice(-n3);
  const mediaIni = inicio.length ? inicio.reduce((s, p) => s + p.precoMedio, 0) / inicio.length : 0;
  const mediaFim = fim.length ? fim.reduce((s, p) => s + p.precoMedio, 0) / fim.length : 0;
  const varPct = mediaIni ? ((mediaFim - mediaIni) / mediaIni) * 100 : 0;

  const globalPorMesNum = useMemo(() => {
    const mapa = new Map<number, { soma: number; qtd: number }>();
    for (const p of porMesUf) {
      const mesNum = new Date(p.mes).getUTCMonth();
      const atual = mapa.get(mesNum) ?? { soma: 0, qtd: 0 };
      atual.soma += p.precoMedio * p.qtd;
      atual.qtd += p.qtd;
      mapa.set(mesNum, atual);
    }
    return Array.from(mapa.entries()).map(([mesNum, v]) => ({ mesNum, media: v.qtd > 0 ? v.soma / v.qtd : 0 }));
  }, [porMesUf]);
  const mesMaisCaro = globalPorMesNum.length ? globalPorMesNum.reduce((a, b) => (b.media > a.media ? b : a)) : null;
  const mesMaisBarato = globalPorMesNum.length ? globalPorMesNum.reduce((a, b) => (b.media < a.media ? b : a)) : null;

  const volPorCombustivel = useMemo(() => {
    const mapa = new Map<string, { soma: number; qtd: number }>();
    for (const v of volatilidade) {
      const atual = mapa.get(v.combustivel) ?? { soma: 0, qtd: 0 };
      atual.soma += v.volatilidade;
      atual.qtd += 1;
      mapa.set(v.combustivel, atual);
    }
    return Array.from(mapa.entries()).map(([combustivel, v]) => ({ combustivel, media: v.qtd > 0 ? v.soma / v.qtd : 0 }));
  }, [volatilidade]);
  const maisVolatil = volPorCombustivel.length ? volPorCombustivel.reduce((a, b) => (b.media > a.media ? b : a)) : null;

  const ufMaiorAlta = [...seriesPorUf].filter((s) => s.tendenciaMes > 0.01).sort((a, b) => b.tendenciaMes - a.tendenciaMes)[0];

  if (serie.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Histórico de preços insuficiente para calcular tendências.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
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

      <div className="mb-6 space-y-2">
        <Insight texto={`${varPct > 5 ? "📈 Alta tendência geral" : varPct < -5 ? "📉 Queda de preços no período" : "➡️ Preços relativamente estáveis"} — variação de ${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}% entre o início e o fim do período analisado.`} />
        {mesMaisCaro && mesMaisBarato && (
          <Insight
            texto={`📅 Sazonalidade: ${NOMES_MES_COMPLETO[mesMaisCaro.mesNum]} costuma ser o mês mais caro e ${NOMES_MES_COMPLETO[mesMaisBarato.mesNum]} o mais barato — considere concentrar abastecimentos maiores em ${NOMES_MES_COMPLETO[mesMaisBarato.mesNum]}.`}
          />
        )}
        {maisVolatil && <Insight texto={`⚡ Combustível mais volátil: ${maisVolatil.combustivel} (desvio padrão médio de ${formatarMoeda(maisVolatil.media)}).`} />}
        {ufMaiorAlta && <Insight texto={`🔺 Maior alta: ${ufMaiorAlta.uf}, subindo ${formatarMoeda(ufMaiorAlta.tendenciaMes)}/mês em média.`} />}
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Tendência de preço por estado (regressão linear)</h3>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={dadosGraficoTendencia} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
            <Tooltip formatter={(v: number) => formatarMoeda(v)} />
            <Legend />
            {seriesPorUf.map((s) => (
              <Line key={s.uf} type="monotone" dataKey={s.uf} name={s.uf} stroke={s.cor} strokeWidth={2} dot={{ r: 2 }} connectNulls />
            ))}
            {seriesPorUf.map((s) => (
              <Line
                key={`${s.uf}_tend`}
                type="linear"
                dataKey={`${s.uf}_tend`}
                name={`${s.uf} (tendência)`}
                stroke={s.cor}
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                legendType="none"
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Sazonalidade — preço médio por mês do ano</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-1 text-left text-slate-500">UF</th>
                {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((m) => (
                  <th key={m} className="p-1 text-center text-slate-500">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.linhas.map((l) => (
                <tr key={l.uf}>
                  <td className="p-1 font-medium text-slate-700">{l.uf}</td>
                  {l.valores.map((v, i) => (
                    <td
                      key={i}
                      className="p-1 text-center text-white"
                      style={{ backgroundColor: corCelula(v, heatmap.min, heatmap.max) }}
                      title={v != null ? formatarMoeda(v) : "sem dado"}
                    >
                      {v != null ? v.toFixed(2) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Volatilidade por combustível (desvio padrão mensal)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={dadosVolatilidade} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
            <Tooltip formatter={(v: number) => formatarMoeda(v)} />
            <Legend />
            {combustiveisVol.map((c, idx) => (
              <Area
                key={c}
                type="monotone"
                dataKey={c}
                name={c}
                stroke={CORES_COMBUSTIVEL[idx % CORES_COMBUSTIVEL.length]}
                fill={CORES_COMBUSTIVEL[idx % CORES_COMBUSTIVEL.length]}
                fillOpacity={0.2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Resumo por estado</h3>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">UF</th>
              <th className="py-2 pr-3">Preço médio</th>
              <th className="py-2 pr-3">Mínimo</th>
              <th className="py-2 pr-3">Máximo</th>
              <th className="py-2 pr-3">Volatilidade σ</th>
              <th className="py-2 pr-3">Tendência</th>
              <th className="py-2">Δ R$/mês</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...seriesPorUf]
              .sort((a, b) => a.uf.localeCompare(b.uf))
              .map((s) => (
                <tr key={s.uf}>
                  <td className="py-2 pr-3 text-slate-700">{s.uf}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(s.media)}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(s.minimo)}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(s.maximo)}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(s.desvio)}</td>
                  <td className="py-2 pr-3">
                    {s.tendenciaMes > 0.01 ? "📈 Alta" : s.tendenciaMes < -0.01 ? "📉 Queda" : "➡️ Estável"}
                  </td>
                  <td className="py-2 tabular-nums text-slate-600">
                    {s.tendenciaMes >= 0 ? "+" : ""}
                    {formatarMoeda(s.tendenciaMes)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Insight({ texto }: { texto: string }) {
  return <div className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-slate-700">{texto}</div>;
}
