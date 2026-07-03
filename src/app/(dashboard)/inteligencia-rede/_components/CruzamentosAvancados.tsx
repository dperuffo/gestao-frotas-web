"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AbasPainel } from "./AbasPainel";
import MapaFrotaRealLazy from "./MapaFrotaRealLazy";
import type { PontoFrotaReal } from "./MapaFrotaReal";

export type PrecoUf = { uf: string; combustivel: string; precoMedio: number; qtdPostos: number };
export type RegistroPreco = { cnpj: string; razaoSocial: string | null; municipio: string | null; uf: string | null; combustivel: string; preco: number };
export type DesvioAnp = { cnpj: string; razaoSocial: string | null; municipio: string | null; uf: string | null; combustivel: string; precoGf: number; precoAnp: number; nivelAnp: string; diffPct: number };
export type PostoVisitado = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  lat: number | null;
  lon: number | null;
  visitas: number;
  precoMedio: number;
  litrosTotal: number;
};

function formatarMoeda(v: number, casas = 3) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function formatarInt(v: number) {
  return v.toLocaleString("pt-BR");
}
function truncar(texto: string, tamanho: number) {
  return texto.length > tamanho ? `${texto.slice(0, tamanho)}…` : texto;
}
function quantil(valores: number[], q: number) {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + resto * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function useCombustivelSelect(opcoes: string[]) {
  const [sel, setSel] = useState(opcoes[0] ?? "");
  const atual = opcoes.includes(sel) ? sel : opcoes[0] ?? "";
  return { atual, setSel, opcoes };
}

export function CruzamentosAvancados({
  precosPorUf,
  historico,
  desvios,
  postosVisitados,
  dieselAnpPorUf,
}: {
  precosPorUf: PrecoUf[];
  historico: RegistroPreco[];
  desvios: DesvioAnp[];
  postosVisitados: PostoVisitado[];
  dieselAnpPorUf: Record<string, number>;
}) {
  const combustiveis = useMemo(() => Array.from(new Set(precosPorUf.map((p) => p.combustivel))).sort(), [precosPorUf]);

  return (
    <AbasPainel
      abas={[
        {
          id: "regioes",
          label: "🗺️ Regiões caras vs baratas",
          conteudo: <RegioesCarasBaratas precosPorUf={precosPorUf} combustiveis={combustiveis} />,
        },
        {
          id: "clusters",
          label: "🎯 Clusters de oportunidade",
          conteudo: <ClustersOportunidade historico={historico} combustiveis={combustiveis} />,
        },
        {
          id: "gf-vs-anp",
          label: "⚖️ GF vs Concorrência",
          conteudo: <GfVsConcorrencia desvios={desvios} combustiveis={combustiveis} />,
        },
        {
          id: "frota-real",
          label: "🚛 Frota Real",
          conteudo: <FrotaReal postosVisitados={postosVisitados} dieselAnpPorUf={dieselAnpPorUf} />,
        },
      ]}
    />
  );
}

function RegioesCarasBaratas({ precosPorUf, combustiveis }: { precosPorUf: PrecoUf[]; combustiveis: string[] }) {
  const { atual, setSel } = useCombustivelSelect(combustiveis);

  const dados = useMemo(() => {
    const filtrado = precosPorUf.filter((p) => p.combustivel === atual).sort((a, b) => b.precoMedio - a.precoMedio);
    if (filtrado.length === 0) return null;
    const precos = filtrado.map((p) => p.precoMedio);
    const p25 = quantil(precos, 0.25);
    const p75 = quantil(precos, 0.75);
    const mediaGeral = precos.reduce((a, b) => a + b, 0) / precos.length;
    const linhas = filtrado.map((p) => ({
      ...p,
      categoria: p.precoMedio >= p75 ? "🔴 Caro" : p.precoMedio <= p25 ? "🟢 Barato" : "🟡 Médio",
      cor: p.precoMedio >= p75 ? "#E53935" : p.precoMedio <= p25 ? "#43A047" : "#F57C00",
    }));
    const maisCara = linhas[0];
    const maisBarata = linhas[linhas.length - 1];
    const spread = maisCara.precoMedio - maisBarata.precoMedio;
    const spreadPct = maisBarata.precoMedio ? (spread / maisBarata.precoMedio) * 100 : 0;
    return { linhas, mediaGeral, maisCara, maisBarata, spread, spreadPct };
  }, [precosPorUf, atual]);

  return (
    <div>
      <SeletorCombustivel opcoes={combustiveis} atual={atual} onChange={setSel} />
      {!dados ? (
        <p className="p-4 text-sm text-slate-400">Sem preços cadastrados para esse combustível.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <CardDestaque
              titulo="🔴 UF mais cara"
              valor={dados.maisCara.uf}
              linha1={formatarMoeda(dados.maisCara.precoMedio)}
              linha2={`${dados.maisCara.qtdPostos} postos`}
              bg="#fff3f3"
              borda="#E53935"
            />
            <CardDestaque
              titulo="🟢 UF mais barata"
              valor={dados.maisBarata.uf}
              linha1={formatarMoeda(dados.maisBarata.precoMedio)}
              linha2={`${dados.maisBarata.qtdPostos} postos`}
              bg="#f3fff3"
              borda="#43A047"
            />
            <CardDestaque
              titulo="↕️ Spread entre extremos"
              valor={formatarMoeda(dados.spread)}
              linha1={`${dados.spreadPct.toFixed(1)}% de diferença`}
              bg="#f0f4ff"
              borda="#1040A0"
            />
          </div>

          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={dados.linhas} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <ReferenceLine
                y={dados.mediaGeral}
                stroke="#1040A0"
                strokeDasharray="4 4"
                label={{ value: `Média geral ${formatarMoeda(dados.mediaGeral)}`, position: "insideTopRight", fontSize: 10, fill: "#1040A0" }}
              />
              <Bar dataKey="precoMedio" name="Preço médio" radius={[4, 4, 0, 0]}>
                {dados.linhas.map((l) => (
                  <Cell key={l.uf} fill={l.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">UF</th>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Preço médio</th>
                  <th className="py-2">Postos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.linhas.map((l) => (
                  <tr key={l.uf}>
                    <td className="py-2 pr-3 text-slate-700">{l.uf}</td>
                    <td className="py-2 pr-3">{l.categoria}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700">{formatarMoeda(l.precoMedio, 4)}</td>
                    <td className="py-2 tabular-nums text-slate-600">{l.qtdPostos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const CORES_CLUSTER: Record<string, string> = {
  "🔴 Caro (>+5%)": "#E53935",
  "🟡 Acima da média (+2% a +5%)": "#F57C00",
  "🟢 Abaixo da média (-2% a +2%)": "#66BB6A",
  "🟢 Barato (<-2%)": "#1B5E20",
};

function classificarCluster(delta: number): string {
  if (delta > 5) return "🔴 Caro (>+5%)";
  if (delta > 2) return "🟡 Acima da média (+2% a +5%)";
  if (delta > -2) return "🟢 Abaixo da média (-2% a +2%)";
  return "🟢 Barato (<-2%)";
}

function ClustersOportunidade({ historico, combustiveis }: { historico: RegistroPreco[]; combustiveis: string[] }) {
  const { atual, setSel } = useCombustivelSelect(combustiveis);

  const municipios = useMemo(() => {
    const mapa = new Map<string, { uf: string; municipio: string; postos: Set<string>; soma: number; qtd: number }>();
    for (const r of historico) {
      if (r.combustivel !== atual || !r.uf || !r.municipio) continue;
      const chave = `${r.uf}__${r.municipio}`;
      const atual2 = mapa.get(chave) ?? { uf: r.uf, municipio: r.municipio, postos: new Set<string>(), soma: 0, qtd: 0 };
      atual2.postos.add(r.cnpj);
      atual2.soma += r.preco;
      atual2.qtd += 1;
      mapa.set(chave, atual2);
    }
    const linhas = Array.from(mapa.values()).map((v) => ({ uf: v.uf, municipio: v.municipio, precoMedio: v.soma / v.qtd, postos: v.postos.size }));
    if (linhas.length === 0) return null;
    const mediaNac = linhas.reduce((s, l) => s + l.precoMedio, 0) / linhas.length;
    const comCluster = linhas
      .map((l) => ({ ...l, deltaVsMedia: mediaNac ? ((l.precoMedio - mediaNac) / mediaNac) * 100 : 0 }))
      .map((l) => ({ ...l, cluster: classificarCluster(l.deltaVsMedia) }));
    return { linhas: comCluster, mediaNac };
  }, [historico, atual]);

  const contagemCluster = useMemo(() => {
    if (!municipios) return [];
    const mapa = new Map<string, number>();
    for (const l of municipios.linhas) mapa.set(l.cluster, (mapa.get(l.cluster) ?? 0) + l.postos);
    return Array.from(mapa.entries()).map(([cluster, postos]) => ({ cluster, postos }));
  }, [municipios]);

  const top15 = useMemo(() => (municipios ? [...municipios.linhas].sort((a, b) => a.deltaVsMedia - b.deltaVsMedia).slice(0, 15) : []), [municipios]);

  return (
    <div>
      <SeletorCombustivel opcoes={combustiveis} atual={atual} onChange={setSel} />
      <p className="mb-4 text-xs text-slate-400">
        Municípios agrupados por faixa de preço GF. 🟢 Oportunidade = preço abaixo da média nacional. 🔴 Atenção = preço
        acima da média nacional.
      </p>
      {!municipios ? (
        <p className="p-4 text-sm text-slate-400">Sem dados de município para esse combustível.</p>
      ) : (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">Distribuição por cluster</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={contagemCluster} dataKey="postos" nameKey="cluster" innerRadius={60} outerRadius={100} label={(e) => e.cluster.split(" ")[0]}>
                    {contagemCluster.map((c) => (
                      <Cell key={c.cluster} fill={CORES_CLUSTER[c.cluster] ?? "#999"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, _n, item) => [`${v} postos`, item.payload.cluster]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">Top 15 municípios mais baratos</p>
              <BarraHorizontal
                dados={top15.map((m) => ({
                  label: `${truncar(m.municipio, 20)} (${m.uf})`,
                  valor: Math.abs(m.deltaVsMedia),
                  cor: m.deltaVsMedia < 0 ? "#43A047" : "#F57C00",
                  texto: `${m.deltaVsMedia >= 0 ? "+" : ""}${m.deltaVsMedia.toFixed(1)}%`,
                }))}
                eixoX="Δ% vs média nacional"
              />
            </div>
          </div>

          <p className="mb-2 text-xs font-medium text-slate-600">📋 Tabela completa de municípios</p>
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Município</th>
                  <th className="py-2 pr-3">UF</th>
                  <th className="py-2 pr-3">Cluster</th>
                  <th className="py-2 pr-3">Preço médio</th>
                  <th className="py-2 pr-3">Δ% vs média</th>
                  <th className="py-2">Postos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...municipios.linhas]
                  .sort((a, b) => a.deltaVsMedia - b.deltaVsMedia)
                  .map((m) => (
                    <tr key={`${m.uf}__${m.municipio}`}>
                      <td className="py-2 pr-3 text-slate-700">{m.municipio}</td>
                      <td className="py-2 pr-3 text-slate-600">{m.uf}</td>
                      <td className="py-2 pr-3">{m.cluster}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-700">{formatarMoeda(m.precoMedio, 4)}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-600">
                        {m.deltaVsMedia >= 0 ? "+" : ""}
                        {m.deltaVsMedia.toFixed(2)}%
                      </td>
                      <td className="py-2 tabular-nums text-slate-600">{m.postos}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function GfVsConcorrencia({ desvios, combustiveis }: { desvios: DesvioAnp[]; combustiveis: string[] }) {
  const { atual, setSel } = useCombustivelSelect(combustiveis);

  const comp = useMemo(() => {
    const mapa = new Map<string, { somaGf: number; somaAnp: number; n: number; nivel: string }>();
    for (const d of desvios) {
      if (d.combustivel !== atual || !d.uf) continue;
      const at = mapa.get(d.uf) ?? { somaGf: 0, somaAnp: 0, n: 0, nivel: d.nivelAnp };
      at.somaGf += d.precoGf;
      at.somaAnp += d.precoAnp;
      at.n += 1;
      mapa.set(d.uf, at);
    }
    const linhas = Array.from(mapa.entries())
      .map(([uf, v]) => {
        const gfMed = v.somaGf / v.n;
        const anpMed = v.somaAnp / v.n;
        const deltaAbs = gfMed - anpMed;
        const deltaPct = anpMed ? (deltaAbs / anpMed) * 100 : 0;
        return { uf, gfMed, anpMed, deltaAbs, deltaPct, nivelAnp: v.nivel, postos: v.n };
      })
      .sort((a, b) => b.deltaPct - a.deltaPct);
    return linhas;
  }, [desvios, atual]);

  const nCaros = comp.filter((c) => c.deltaPct > 5).length;
  const nBaratos = comp.filter((c) => c.deltaPct < -2).length;
  const nOk = comp.length - nCaros - nBaratos;
  const deltaMedio = comp.length ? comp.reduce((s, c) => s + c.deltaPct, 0) / comp.length : 0;

  const alertas = comp.filter((c) => c.deltaPct > 5).sort((a, b) => b.deltaPct - a.deltaPct);
  const oportunidades = [...comp].filter((c) => c.deltaPct < -2).sort((a, b) => a.deltaPct - b.deltaPct);

  return (
    <div>
      <SeletorCombustivel opcoes={combustiveis} atual={atual} onChange={setSel} />
      {comp.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Sem referência ANP resolvida para esse combustível.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniKpi label="🔴 UFs caras (>+5%)" valor={formatarInt(nCaros)} />
            <MiniKpi label="🟢 UFs baratas (<-2%)" valor={formatarInt(nBaratos)} />
            <MiniKpi label="🟡 Faixa competitiva" valor={formatarInt(nOk)} />
            <MiniKpi label="📊 Delta médio" valor={`${deltaMedio >= 0 ? "+" : ""}${deltaMedio.toFixed(1)}%`} />
          </div>

          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={comp} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <ReferenceLine y={0} stroke="#1040A0" label={{ value: "Paridade ANP", position: "insideTopLeft", fontSize: 10, fill: "#1040A0" }} />
              <Bar dataKey="deltaPct" name="Delta vs ANP" radius={[4, 4, 0, 0]}>
                {comp.map((c) => (
                  <Cell key={c.uf} fill={c.deltaPct > 5 ? "#E53935" : c.deltaPct > 0 ? "#F57C00" : "#43A047"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mb-4 mt-1 text-xs text-slate-400">Zona competitiva considerada: -2% a +5% vs ANP.</p>

          {alertas.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-slate-600">⚠️ Atenção</p>
              {alertas.map((a) => (
                <div key={a.uf} className="rounded-lg border-l-4 bg-red-50 px-3 py-2 text-sm" style={{ borderColor: "#E53935" }}>
                  🔴 <strong>{a.uf}</strong> — GF {formatarMoeda(a.gfMed)} vs ANP {formatarMoeda(a.anpMed)} (
                  {a.deltaPct >= 0 ? "+" : ""}
                  {a.deltaPct.toFixed(1)}%) · Custo extra: {formatarMoeda(Math.abs(a.deltaAbs) * 100, 2)} por 100 litros ·{" "}
                  {a.postos} postos · Ref. ANP: {a.nivelAnp}
                </div>
              ))}
            </div>
          )}

          {oportunidades.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-slate-600">💚 Destaque</p>
              {oportunidades.map((o) => (
                <div key={o.uf} className="rounded-lg border-l-4 bg-emerald-50 px-3 py-2 text-sm" style={{ borderColor: "#43A047" }}>
                  💚 <strong>{o.uf}</strong> — GF {formatarMoeda(o.gfMed)} vs ANP {formatarMoeda(o.anpMed)} ({o.deltaPct.toFixed(1)}%) ·
                  Saving: {formatarMoeda(Math.abs(o.deltaAbs) * 100, 2)} por 100 litros · {o.postos} postos
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">UF</th>
                  <th className="py-2 pr-3">GF médio</th>
                  <th className="py-2 pr-3">ANP ref.</th>
                  <th className="py-2 pr-3">Delta (R$/L)</th>
                  <th className="py-2 pr-3">Delta (%)</th>
                  <th className="py-2 pr-3">Nível ANP</th>
                  <th className="py-2">Postos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comp.map((c) => (
                  <tr key={c.uf}>
                    <td className="py-2 pr-3 text-slate-700">{c.uf}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700">{formatarMoeda(c.gfMed, 4)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(c.anpMed, 4)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(c.deltaAbs, 4)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {c.deltaPct >= 0 ? "+" : ""}
                      {c.deltaPct.toFixed(2)}%
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-400">{c.nivelAnp}</td>
                    <td className="py-2 tabular-nums text-slate-600">{c.postos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FrotaReal({ postosVisitados, dieselAnpPorUf }: { postosVisitados: PostoVisitado[]; dieselAnpPorUf: Record<string, number> }) {
  const totalVisitas = postosVisitados.reduce((s, p) => s + p.visitas, 0);
  const ufsCobertas = new Set(postosVisitados.map((p) => p.uf).filter(Boolean)).size;
  const precoMedioPago = totalVisitas > 0 ? postosVisitados.reduce((s, p) => s + p.precoMedio * p.visitas, 0) / totalVisitas : 0;

  const { min, max } = useMemo(() => {
    const precos = postosVisitados.map((p) => p.precoMedio);
    return { min: precos.length ? Math.min(...precos) : 0, max: precos.length ? Math.max(...precos) : 0 };
  }, [postosVisitados]);

  const pontosMapa = useMemo<PontoFrotaReal[]>(() => {
    const faixa = Math.max(max - min, 0.01);
    return postosVisitados
      .filter((p): p is PostoVisitado & { lat: number; lon: number } => p.lat != null && p.lon != null)
      .map((p) => {
        const norm = (p.precoMedio - min) / faixa;
        const cor = norm < 0.33 ? "#43A047" : norm < 0.66 ? "#F57C00" : "#E53935";
        return { cnpj: p.cnpj, razaoSocial: p.razaoSocial, municipio: p.municipio, uf: p.uf, visitas: p.visitas, precoMedio: p.precoMedio, cor, lat: p.lat, lon: p.lon };
      });
  }, [postosVisitados, min, max]);

  const ranking = useMemo(() => [...postosVisitados].sort((a, b) => b.visitas - a.visitas).slice(0, 15), [postosVisitados]);

  const porUf = useMemo(() => {
    const mapa = new Map<string, { soma: number; visitas: number }>();
    for (const p of postosVisitados) {
      if (!p.uf) continue;
      const at = mapa.get(p.uf) ?? { soma: 0, visitas: 0 };
      at.soma += p.precoMedio * p.visitas;
      at.visitas += p.visitas;
      mapa.set(p.uf, at);
    }
    return Array.from(mapa.entries())
      .map(([uf, v]) => {
        const precoReal = v.visitas > 0 ? v.soma / v.visitas : 0;
        const anpRef = dieselAnpPorUf[uf];
        const deltaPct = anpRef ? ((precoReal - anpRef) / anpRef) * 100 : null;
        return { uf, precoReal, visitas: v.visitas, anpRef: anpRef ?? null, deltaPct };
      })
      .sort((a, b) => b.precoReal - a.precoReal);
  }, [postosVisitados, dieselAnpPorUf]);

  if (postosVisitados.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Ainda não há abastecimentos com coordenada do posto — conecte a integração PróFrotas em Integrações para
        acumular esse histórico.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi label="⛽ Abastecimentos" valor={formatarInt(totalVisitas)} />
        <MiniKpi label="📍 Postos distintos" valor={formatarInt(postosVisitados.length)} />
        <MiniKpi label="🗺️ UFs cobertas" valor={formatarInt(ufsCobertas)} />
        <MiniKpi label="💰 Preço médio pago" valor={formatarMoeda(precoMedioPago)} />
      </div>

      <p className="mb-2 text-xs font-medium text-slate-600">🌎 Mapa de calor — postos visitados pela frota</p>
      <p className="mb-2 text-xs text-slate-400">Tamanho = frequência de visitas. Cor = preço médio pago (verde barato → vermelho caro).</p>
      <MapaFrotaRealLazy pontos={pontosMapa} />

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <p className="mb-2 text-xs font-medium text-slate-600">🏆 Ranking de postos mais utilizados</p>
          <BarraHorizontal
            dados={ranking.map((p) => ({ label: truncar(p.razaoSocial ?? p.cnpj, 30), valor: p.visitas, cor: "#283593", texto: formatarInt(p.visitas) }))}
            eixoX="Abastecimentos"
          />
        </div>
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-medium text-slate-600">📊 Preço pago por UF (ref.: Diesel S10 ANP)</p>
          <ResponsiveContainer width="100%" height={Math.max(220, porUf.length * 26)}>
            <BarChart data={porUf} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <YAxis type="category" dataKey="uf" width={32} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} />
              <Legend />
              <Bar dataKey="precoReal" name="Preço pago" fill="#E65100" radius={[0, 4, 4, 0]} />
              <Bar dataKey="anpRef" name="ANP Diesel S10" fill="#7B1FA2" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">UF</th>
              <th className="py-2 pr-3">Preço real</th>
              <th className="py-2 pr-3">Abastecimentos</th>
              <th className="py-2 pr-3">ANP ref. (Diesel S10)</th>
              <th className="py-2">Δ% vs ANP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {porUf.map((u) => (
              <tr key={u.uf}>
                <td className="py-2 pr-3 text-slate-700">{u.uf}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-700">{formatarMoeda(u.precoReal)}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{u.visitas}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-600">{u.anpRef != null ? formatarMoeda(u.anpRef) : "—"}</td>
                <td className="py-2 tabular-nums text-slate-600">
                  {u.deltaPct != null ? `${u.deltaPct >= 0 ? "+" : ""}${u.deltaPct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeletorCombustivel({ opcoes, atual, onChange }: { opcoes: string[]; atual: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <label className="text-xs font-medium text-slate-500">Combustível:</label>
      <select value={atual} onChange={(e) => onChange(e.target.value)} className="input w-auto text-sm">
        {opcoes.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

function CardDestaque({ titulo, valor, linha1, linha2, bg, borda }: { titulo: string; valor: string; linha1: string; linha2?: string; bg: string; borda: string }) {
  return (
    <div className="rounded-lg border-l-4 p-3 text-sm" style={{ backgroundColor: bg, borderColor: borda }}>
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-600">{linha1}</p>
      {linha2 && <p className="text-xs text-slate-400">{linha2}</p>}
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

function BarraHorizontal({ dados, eixoX }: { dados: { label: string; valor: number; cor: string; texto: string }[]; eixoX: string }) {
  const maxValor = Math.max(1e-9, ...dados.map((d) => d.valor));
  return (
    <div>
      <div className="space-y-1.5">
        {dados.map((d, i) => (
          <div key={`${d.label}__${i}`} className="flex items-center gap-2 text-xs">
            <span className="w-32 shrink-0 truncate text-slate-600" title={d.label}>
              {d.label}
            </span>
            <div className="h-4 flex-1 rounded bg-slate-100">
              <div className="h-4 rounded" style={{ width: `${Math.max(2, (d.valor / maxValor) * 100)}%`, backgroundColor: d.cor }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums text-slate-500">{d.texto}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-right text-[10px] uppercase text-slate-400">{eixoX}</p>
    </div>
  );
}
