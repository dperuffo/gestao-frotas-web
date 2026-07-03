"use client";

import { useMemo } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { calcularScorePosto, CORES_GRADE } from "@/lib/scorePosto";
import type { RegistroHistorico } from "./Anomalias";
import type { DesvioAnpFrota, ServicoPostoFrota } from "../../postos/_components/ScoreFrota";

const PRIORIDADE_COMBUSTIVEL = ["Diesel S-10 Comum", "Diesel S-10 Aditivado", "Diesel S-500 Comum", "Diesel S-500 Aditivado", "Gasolina Comum"];

// Matriz quadrante: cruza o score de qualidade do posto (preço vs ANP +
// serviços) com o quanto ele é utilizado (nº de registros de preço no
// histórico, como proxy de movimentação/relevância). Ajuda a identificar
// onde investir (score alto + baixa utilização = oportunidade de crescer
// volume) e onde tem risco (score baixo + alta utilização = muito usado
// mas caro/mal avaliado).
export function ScorePerformance({
  historico,
  desvios,
  servicos,
}: {
  historico: RegistroHistorico[];
  desvios: DesvioAnpFrota[];
  servicos: ServicoPostoFrota[];
}) {
  const pontos = useMemo(() => {
    const desviosPorCnpj = new Map<string, DesvioAnpFrota[]>();
    for (const d of desvios) {
      if (!d.uf) continue;
      if (!desviosPorCnpj.has(d.cnpj)) desviosPorCnpj.set(d.cnpj, []);
      desviosPorCnpj.get(d.cnpj)!.push(d);
    }
    const servicosPorCnpj = new Map(servicos.map((s) => [s.cnpj, s]));
    const utilizacaoPorCnpj = new Map<string, number>();
    for (const r of historico) {
      utilizacaoPorCnpj.set(r.cnpj, (utilizacaoPorCnpj.get(r.cnpj) ?? 0) + 1);
    }

    const resultado: { cnpj: string; razaoSocial: string | null; uf: string; score: number; grade: "A" | "B" | "C" | "D"; utilizacao: number }[] = [];
    for (const [cnpj, linhas] of desviosPorCnpj.entries()) {
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
      const { score, grade } = calcularScorePosto(preferida.diffPct, nServicos);
      resultado.push({
        cnpj,
        razaoSocial: preferida.razaoSocial,
        uf: preferida.uf!,
        score,
        grade,
        utilizacao: utilizacaoPorCnpj.get(cnpj) ?? 0,
      });
    }
    return resultado;
  }, [historico, desvios, servicos]);

  const scoreMedio = pontos.length ? pontos.reduce((s, p) => s + p.score, 0) / pontos.length : 50;
  const utilizacaoMedia = pontos.length ? pontos.reduce((s, p) => s + p.utilizacao, 0) / pontos.length : 0;

  const quadrantes = useMemo(() => {
    const q: Record<"investir" | "manter" | "risco" | "revisar", typeof pontos> = { investir: [], manter: [], risco: [], revisar: [] };
    for (const p of pontos) {
      const scoreAlto = p.score >= scoreMedio;
      const usoAlto = p.utilizacao >= utilizacaoMedia;
      if (scoreAlto && usoAlto) q.manter.push(p);
      else if (scoreAlto && !usoAlto) q.investir.push(p);
      else if (!scoreAlto && usoAlto) q.risco.push(p);
      else q.revisar.push(p);
    }
    return q;
  }, [pontos, scoreMedio, utilizacaoMedia]);

  if (pontos.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Ainda não há score e utilização suficientes pra montar a matriz.</p>;
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Cada ponto é um posto: eixo X = utilização (registros de preço no histórico), eixo Y = score de
        qualidade. Linhas tracejadas marcam a média de cada eixo, dividindo em 4 quadrantes.
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuadranteKpi titulo="🟢 Oportunidade de crescer" valor={quadrantes.investir.length} descricao="Score alto, uso baixo" />
        <QuadranteKpi titulo="✅ Manter" valor={quadrantes.manter.length} descricao="Score alto, uso alto" />
        <QuadranteKpi titulo="🔴 Risco" valor={quadrantes.risco.length} descricao="Score baixo, uso alto" />
        <QuadranteKpi titulo="⚠️ Revisar" valor={quadrantes.revisar.length} descricao="Score baixo, uso baixo" />
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" dataKey="utilizacao" name="Utilização" tick={{ fontSize: 12 }} label={{ value: "Utilização (registros)", position: "insideBottom", offset: -4, fontSize: 11 }} />
          <YAxis type="number" dataKey="score" name="Score" domain={[0, 100]} tick={{ fontSize: 12 }} label={{ value: "Score", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <ZAxis range={[60, 60]} />
          <ReferenceLine x={utilizacaoMedia} stroke="#64748b" strokeDasharray="4 4" />
          <ReferenceLine y={scoreMedio} stroke="#64748b" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0].payload as (typeof pontos)[number];
              return (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-slate-800">{p.razaoSocial ?? p.cnpj}</p>
                  <p className="text-slate-500">{p.uf}</p>
                  <p className="text-slate-600">
                    Score: <strong>{p.score.toFixed(1)}</strong> (Grau {p.grade}) · Utilização: <strong>{p.utilizacao}</strong>
                  </p>
                </div>
              );
            }}
          />
          {(["A", "B", "C", "D"] as const).map((g) => (
            <Scatter key={g} name={`Grau ${g}`} data={pontos.filter((p) => p.grade === g)} fill={CORES_GRADE[g]} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      <p className="mb-2 mt-4 text-xs font-medium text-slate-600">🔴 Postos em risco (score baixo, uso alto) — atenção prioritária</p>
      {quadrantes.risco.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum posto nesse quadrante.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Posto</th>
                <th className="py-2 pr-3">UF</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2">Utilização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quadrantes.risco
                .sort((a, b) => b.utilizacao - a.utilizacao)
                .map((p) => (
                  <tr key={p.cnpj}>
                    <td className="py-2 pr-3 text-slate-700">{p.razaoSocial ?? p.cnpj}</td>
                    <td className="py-2 pr-3 text-slate-600">{p.uf}</td>
                    <td className="py-2 pr-3 tabular-nums font-medium" style={{ color: CORES_GRADE[p.grade] }}>
                      {p.score.toFixed(1)}
                    </td>
                    <td className="py-2 tabular-nums text-slate-600">{p.utilizacao}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuadranteKpi({ titulo, valor, descricao }: { titulo: string; valor: number; descricao: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-400">{descricao}</p>
    </div>
  );
}
