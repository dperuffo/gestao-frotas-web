"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AbasPainel } from "./AbasPainel";
import MapaPrecoOperacionalLazy from "./MapaPrecoOperacionalLazy";
import type { PontoPrecoMapa } from "./MapaPrecoOperacional";

export type PontoPrecoBruto = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  combustivel: string;
  preco: number;
  lat: number | null;
  lon: number | null;
};

export type DesvioAnp = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  combustivel: string;
  precoGf: number;
  precoAnp: number;
  nivelAnp: string;
  diffPct: number;
};

export type ServicoPosto = {
  cnpj: string;
  arla: boolean | null;
  funciona24h: boolean | null;
  possuiBanheiro: boolean | null;
  possuiEstacionamento: boolean | null;
  possuiInternet: boolean | null;
  possuiOleoGranel: boolean | null;
  possuiRestaurante: boolean | null;
  possuiTrocaOleo: boolean | null;
  pistaCaminhao: boolean | null;
  conveniencia: boolean | null;
  convenienciaAmPm: boolean | null;
};

const REGIOES: Record<string, string[]> = {
  Norte: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};
const UF_PARA_MACRO: Record<string, string> = Object.fromEntries(
  Object.entries(REGIOES).flatMap(([regiao, ufs]) => ufs.map((uf) => [uf, regiao]))
);

const PRIORIDADE_COMBUSTIVEL = ["Diesel S-10 Comum", "Diesel S-10 Aditivado", "Diesel S-500 Comum", "Diesel S-500 Aditivado", "Gasolina Comum"];
const CORES_GRADE: Record<string, string> = { A: "#27AE60", B: "#3498DB", C: "#F39C12", D: "#E74C3C" };

function formatarMoeda(v: number, casas = 3) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function formatarInt(v: number) {
  return v.toLocaleString("pt-BR");
}
function truncar(texto: string, tamanho: number) {
  return texto.length > tamanho ? `${texto.slice(0, tamanho)}…` : texto;
}
function mediana(valores: number[]) {
  if (valores.length === 0) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 === 0 ? (ord[meio - 1] + ord[meio]) / 2 : ord[meio];
}

type Score = { cnpj: string; razaoSocial: string | null; uf: string; macro: string; score: number; grade: "A" | "B" | "C" | "D" };

function calcularScore(diffPctSigned: number, nServicos: number): { score: number; grade: "A" | "B" | "C" | "D" } {
  const diff = diffPctSigned / 100;
  const sPreco = Math.max(0, Math.min(100, 50 - diff * 500));
  const sServ = Math.max(0, Math.min(100, (nServicos / 11) * 100));
  const sDist = 50;
  const score = Math.round((0.5 * sPreco + 0.3 * sServ + 0.2 * sDist) * 10) / 10;
  const grade: "A" | "B" | "C" | "D" = score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";
  return { score, grade };
}

export function Operacional({
  precosMapa,
  desvios,
  servicos,
}: {
  precosMapa: PontoPrecoBruto[];
  desvios: DesvioAnp[];
  servicos: ServicoPosto[];
}) {
  // Score composto por posto — calculado uma vez e reaproveitado nas abas
  // "Score por Região" e "Distribuição A/B/C/D". Preço vs ANP (50%) usa a
  // referência já resolvida (município → estado → Brasil); dentre os
  // combustíveis do posto, prioriza diesel S-10/S-500 e por fim gasolina
  // comum, como no painel de referência. Serviços (30%) conta quantos dos
  // 11 flags de infraestrutura o posto tem. Distância (20%) fica neutra
  // (50 pontos fixos) — o painel original também nunca varia esse
  // componente aqui, já que não há um ponto de referência de rota nesta
  // visão de rede.
  const scores = useMemo<Score[]>(() => {
    const porCnpj = new Map<string, DesvioAnp[]>();
    for (const d of desvios) {
      if (!d.uf) continue;
      if (!porCnpj.has(d.cnpj)) porCnpj.set(d.cnpj, []);
      porCnpj.get(d.cnpj)!.push(d);
    }
    const servicosPorCnpj = new Map(servicos.map((s) => [s.cnpj, s]));
    const resultado: Score[] = [];
    for (const [cnpj, linhas] of porCnpj.entries()) {
      let preferida = linhas[0];
      for (const pref of PRIORIDADE_COMBUSTIVEL) {
        const achada = linhas.find((l) => l.combustivel === pref);
        if (achada) {
          preferida = achada;
          break;
        }
      }
      const s = servicosPorCnpj.get(cnpj);
      const nServicos = s
        ? [s.arla, s.funciona24h, s.possuiBanheiro, s.possuiEstacionamento, s.possuiInternet, s.possuiOleoGranel, s.possuiRestaurante, s.possuiTrocaOleo, s.pistaCaminhao, s.conveniencia, s.convenienciaAmPm].filter(Boolean).length
        : 0;
      const { score, grade } = calcularScore(preferida.diffPct, nServicos);
      resultado.push({
        cnpj,
        razaoSocial: preferida.razaoSocial,
        uf: preferida.uf!,
        macro: UF_PARA_MACRO[preferida.uf!] ?? "Outros",
        score,
        grade,
      });
    }
    return resultado;
  }, [desvios, servicos]);

  if (precosMapa.length === 0 && desvios.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Ainda não há preços/postos suficientes para o painel operacional.</p>;
  }

  return (
    <AbasPainel
      abas={[
        { id: "mapa-precos", label: "🌡️ Mapa de Preços", conteudo: <MapaPrecos precosMapa={precosMapa} /> },
        { id: "inconsistentes", label: "⚡ Postos Inconsistentes", conteudo: <PostosInconsistentes desvios={desvios} /> },
        { id: "score-regiao", label: "⭐ Score por Região", conteudo: <ScorePorRegiao scores={scores} /> },
        { id: "distribuicao-grade", label: "🏅 Distribuição A/B/C/D", conteudo: <DistribuicaoGrade scores={scores} /> },
      ]}
    />
  );
}

function MapaPrecos({ precosMapa }: { precosMapa: PontoPrecoBruto[] }) {
  const combustiveis = useMemo(() => Array.from(new Set(precosMapa.map((p) => p.combustivel))).sort(), [precosMapa]);
  const [sel, setSel] = useState(combustiveis[0] ?? "");

  const filtrado = useMemo(
    () => precosMapa.filter((p): p is PontoPrecoBruto & { lat: number; lon: number } => p.combustivel === sel && p.lat != null && p.lon != null && p.preco > 0),
    [precosMapa, sel]
  );

  const { min, max, med } = useMemo(() => {
    const precos = filtrado.map((p) => p.preco);
    return { min: precos.length ? Math.min(...precos) : 0, max: precos.length ? Math.max(...precos) : 0, med: mediana(precos) };
  }, [filtrado]);

  const pontosColoridos = useMemo<PontoPrecoMapa[]>(() => {
    const faixa = Math.max(max - min, 0.01);
    return filtrado.map((p) => {
      const norm = (p.preco - min) / faixa;
      const cor = norm < 0.33 ? "#27AE60" : norm < 0.66 ? "#F39C12" : "#E74C3C";
      return { cnpj: p.cnpj, razaoSocial: p.razaoSocial, municipio: p.municipio, uf: p.uf, preco: p.preco, cor, lat: p.lat, lon: p.lon };
    });
  }, [filtrado, min, max]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs font-medium text-slate-500">Combustível:</label>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="input w-auto text-sm">
          {combustiveis.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi label="⛽ Postos mapeados" valor={formatarInt(filtrado.length)} />
        <MiniKpi label="💰 Mín" valor={formatarMoeda(min)} />
        <MiniKpi label="💰 Máx" valor={formatarMoeda(max)} />
        <MiniKpi label="📊 Mediana" valor={formatarMoeda(med)} />
      </div>

      <MapaPrecoOperacionalLazy pontos={pontosColoridos} />
      <p className="mt-2 text-xs text-slate-400">
        🟢 Preço baixo (≤33% da faixa) · 🟡 Preço médio · 🔴 Preço alto (≥66% da faixa)
      </p>
    </div>
  );
}

function PostosInconsistentes({ desvios }: { desvios: DesvioAnp[] }) {
  const [tolerancia, setTolerancia] = useState(15);

  const filtrado = useMemo(
    () => desvios.filter((d) => Math.abs(d.diffPct) > tolerancia).sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct)),
    [desvios, tolerancia]
  );
  const top20 = filtrado.slice(0, 20);

  return (
    <div>
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Tolerância de desvio vs ANP: <strong>{tolerancia}%</strong>
        </label>
        <input
          type="range"
          min={5}
          max={40}
          step={5}
          value={tolerancia}
          onChange={(e) => setTolerancia(Number(e.target.value))}
          className="w-full max-w-xs"
        />
        <p className="mt-1 text-xs text-slate-400">Postos com preço mais de {tolerancia}% acima ou abaixo do ANP são sinalizados.</p>
      </div>

      {filtrado.length === 0 ? (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✅ Nenhum posto com desvio superior a {tolerancia}% em relação ao preço ANP de referência.
        </div>
      ) : (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠️ <strong>{filtrado.length} registros</strong> com desvio superior a {tolerancia}% do ANP
        </div>
      )}

      {top20.length > 0 && (
        <>
          <p className="mb-2 text-xs font-medium text-slate-600">Top 20 postos com maior desvio vs ANP</p>
          <BarraHorizontal
            dados={top20.map((d) => ({
              label: `${truncar(d.razaoSocial ?? d.cnpj, 25)} (${d.uf})`,
              valor: Math.abs(d.diffPct),
              cor: d.diffPct > 0 ? "#E74C3C" : "#3498DB",
              texto: `${d.diffPct > 0 ? "+" : ""}${d.diffPct.toFixed(1)}%`,
            }))}
            eixoX="Desvio % vs ANP"
          />
          <p className="mb-4 mt-1 text-xs text-slate-400">🔴 acima do ANP · 🔵 abaixo do ANP</p>

          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Razão Social</th>
                  <th className="py-2 pr-3">Município</th>
                  <th className="py-2 pr-3">UF</th>
                  <th className="py-2 pr-3">Combustível</th>
                  <th className="py-2 pr-3">Preço GF</th>
                  <th className="py-2 pr-3">ANP Ref.</th>
                  <th className="py-2 pr-3">Base</th>
                  <th className="py-2">Desvio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrado.map((d, i) => (
                  <tr key={`${d.cnpj}__${d.combustivel}__${i}`}>
                    <td className="py-2 pr-3 text-slate-700">{d.razaoSocial ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{d.municipio ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{d.uf ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{d.combustivel}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700">{formatarMoeda(d.precoGf)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda(d.precoAnp)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-400">{d.nivelAnp}</td>
                    <td className={`py-2 font-medium ${d.diffPct > 0 ? "text-red-600" : "text-sky-600"}`}>
                      {d.diffPct > 0 ? "+" : ""}
                      {d.diffPct.toFixed(1)}%
                    </td>
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

function ScorePorRegiao({ scores }: { scores: Score[] }) {
  const [granularidade, setGranularidade] = useState<"Macrorregião" | "UF">("Macrorregião");
  const campo: "macro" | "uf" = granularidade === "Macrorregião" ? "macro" : "uf";

  const agrupado = useMemo(() => {
    const mapa = new Map<string, number[]>();
    for (const s of scores) {
      const chave = s[campo];
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(s.score);
    }
    return Array.from(mapa.entries())
      .map(([chave, valores]) => ({
        chave,
        scoreMedio: valores.reduce((a, b) => a + b, 0) / valores.length,
        n: valores.length,
      }))
      .sort((a, b) => b.scoreMedio - a.scoreMedio);
  }, [scores, campo]);

  const scoreGeral = scores.length ? scores.reduce((s, x) => s + x.score, 0) / scores.length : 0;

  if (scores.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem dados suficientes (preço + ANP resolvido) para calcular o score.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs font-medium text-slate-500">Granularidade:</label>
        <div className="flex overflow-hidden rounded-md border border-slate-200 text-sm">
          {(["Macrorregião", "UF"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setGranularidade(opcao)}
              className={`px-3 py-1.5 ${granularidade === opcao ? "bg-frota-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {opcao}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniKpi label="⭐ Score médio geral" valor={scoreGeral.toFixed(1)} />
        <MiniKpi label="🏆 Melhor região" valor={agrupado[0]?.chave ?? "—"} />
        <MiniKpi label="⚠️ Pior região" valor={agrupado[agrupado.length - 1]?.chave ?? "—"} />
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={agrupado} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="chave" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number, name) => (name === "scoreMedio" ? v.toFixed(1) : v)} />
          <ReferenceLine y={70} stroke="#27AE60" strokeDasharray="4 4" label={{ value: "70", position: "right", fontSize: 10, fill: "#27AE60" }} />
          <ReferenceLine y={45} stroke="#F57C00" strokeDasharray="4 4" label={{ value: "45", position: "right", fontSize: 10, fill: "#F57C00" }} />
          <Bar dataKey="scoreMedio" name="Score médio" radius={[4, 4, 0, 0]}>
            {agrupado.map((a) => (
              <Cell key={a.chave} fill={a.scoreMedio >= 70 ? "#27AE60" : a.scoreMedio >= 45 ? "#F39C12" : "#E74C3C"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mb-4 mt-1 text-xs text-slate-400">
        Linhas de referência (70/45) são só uma leitura visual rápida da posição regional — os graus A/B/C/D reais de cada
        posto usam limites diferentes (75/55/35), mostrados na aba seguinte.
      </p>

      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-3">{granularidade}</th>
            <th className="py-2 pr-3">Score médio</th>
            <th className="py-2">Postos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {agrupado.map((a) => (
            <tr key={a.chave}>
              <td className="py-2 pr-3 text-slate-700">{a.chave}</td>
              <td className="py-2 pr-3 tabular-nums text-slate-700">{a.scoreMedio.toFixed(1)}</td>
              <td className="py-2 tabular-nums text-slate-600">{a.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DistribuicaoGrade({ scores }: { scores: Score[] }) {
  const contagem = useMemo(() => {
    const c: Record<"A" | "B" | "C" | "D", number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const s of scores) c[s.grade] += 1;
    return c;
  }, [scores]);
  const total = scores.length;

  const dadosDonut = (["A", "B", "C", "D"] as const).map((g) => ({ name: g, value: contagem[g] }));

  const porUf = useMemo(() => {
    const mapa = new Map<string, Record<"A" | "B" | "C" | "D", number>>();
    for (const s of scores) {
      if (!mapa.has(s.uf)) mapa.set(s.uf, { A: 0, B: 0, C: 0, D: 0 });
      mapa.get(s.uf)![s.grade] += 1;
    }
    return Array.from(mapa.entries())
      .map(([uf, c]) => {
        const totalUf = c.A + c.B + c.C + c.D;
        return {
          uf,
          A: totalUf ? (c.A / totalUf) * 100 : 0,
          B: totalUf ? (c.B / totalUf) * 100 : 0,
          C: totalUf ? (c.C / totalUf) * 100 : 0,
          D: totalUf ? (c.D / totalUf) * 100 : 0,
          contagem: c,
          total: totalUf,
        };
      })
      .sort((a, b) => b.A - a.A);
  }, [scores]);

  if (total === 0) {
    return <p className="p-4 text-sm text-slate-400">Sem dados suficientes para calcular a distribuição de graus.</p>;
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["A", "B", "C", "D"] as const).map((g) => (
          <MiniKpi
            key={g}
            label={`${{ A: "🟢", B: "🔵", C: "🟡", D: "🔴" }[g]} Categoria ${g}`}
            valor={formatarInt(contagem[g])}
            sub={`${((contagem[g] / total) * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">Distribuição geral</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={dadosDonut} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} label={(entry) => `${entry.name} ${((entry.value / total) * 100).toFixed(0)}%`}>
                {dadosDonut.map((d) => (
                  <Cell key={d.name} fill={CORES_GRADE[d.name]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} postos`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">% por categoria — UF</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porUf} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="uf" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="A" name="Grau A" stackId="g" fill={CORES_GRADE.A} />
              <Bar dataKey="B" name="Grau B" stackId="g" fill={CORES_GRADE.B} />
              <Bar dataKey="C" name="Grau C" stackId="g" fill={CORES_GRADE.C} />
              <Bar dataKey="D" name="Grau D" stackId="g" fill={CORES_GRADE.D} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <details className="rounded-lg border border-slate-200">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700">📋 Ver tabela completa por UF</summary>
        <div className="overflow-x-auto p-4 pt-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">UF</th>
                <th className="py-2 pr-3">A</th>
                <th className="py-2 pr-3">B</th>
                <th className="py-2 pr-3">C</th>
                <th className="py-2 pr-3">D</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porUf.map((u) => (
                <tr key={u.uf}>
                  <td className="py-2 pr-3 text-slate-700">{u.uf}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{u.contagem.A}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{u.contagem.B}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{u.contagem.C}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-600">{u.contagem.D}</td>
                  <td className="py-2 tabular-nums text-slate-600">{u.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function MiniKpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
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
            <span className="w-40 shrink-0 truncate text-slate-600" title={d.label}>
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
