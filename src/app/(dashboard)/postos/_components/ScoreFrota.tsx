"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type DesvioAnpFrota = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  combustivel: string;
  diffPct: number;
};

export type ServicoPostoFrota = {
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

const PRIORIDADE_COMBUSTIVEL = ["Diesel S-10 Comum", "Diesel S-10 Aditivado", "Diesel S-500 Comum", "Diesel S-500 Aditivado", "Gasolina Comum"];
const CORES_GRADE: Record<string, string> = { A: "#27AE60", B: "#3498DB", C: "#F39C12", D: "#E74C3C" };

function calcularScore(diffPctSigned: number, nServicos: number): { score: number; grade: "A" | "B" | "C" | "D" } {
  const diff = diffPctSigned / 100;
  const sPreco = Math.max(0, Math.min(100, 50 - diff * 500));
  const sServ = Math.max(0, Math.min(100, (nServicos / 11) * 100));
  const sDist = 50;
  const score = Math.round((0.5 * sPreco + 0.3 * sServ + 0.2 * sDist) * 10) / 10;
  const grade: "A" | "B" | "C" | "D" = score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";
  return { score, grade };
}

// Score composto (mesma fórmula usada na Inteligência de Rede): preço vs
// ANP 50% + cobertura de serviços/infraestrutura 30% + distância neutra
// (20%, sem ponto de referência de rota nesta tela). Graus: A≥75, B≥55,
// C≥35, D<35.
export function ScoreFrota({ desvios, servicos }: { desvios: DesvioAnpFrota[]; servicos: ServicoPostoFrota[] }) {
  const scores = useMemo(() => {
    const porCnpj = new Map<string, DesvioAnpFrota[]>();
    for (const d of desvios) {
      if (!d.uf) continue;
      if (!porCnpj.has(d.cnpj)) porCnpj.set(d.cnpj, []);
      porCnpj.get(d.cnpj)!.push(d);
    }
    const servicosPorCnpj = new Map(servicos.map((s) => [s.cnpj, s]));
    const resultado: { cnpj: string; razaoSocial: string | null; municipio: string | null; uf: string; combustivel: string; score: number; grade: "A" | "B" | "C" | "D" }[] = [];
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
        municipio: preferida.municipio,
        uf: preferida.uf!,
        combustivel: preferida.combustivel,
        score,
        grade,
      });
    }
    return resultado.sort((a, b) => a.score - b.score);
  }, [desvios, servicos]);

  const contagem = useMemo(() => {
    const c: Record<"A" | "B" | "C" | "D", number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const s of scores) c[s.grade] += 1;
    return c;
  }, [scores]);

  if (scores.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Ainda não há preços e/ou dados de serviços suficientes nos postos da sua rede pra calcular o score.
      </p>
    );
  }

  const scoreMedio = scores.reduce((s, x) => s + x.score, 0) / scores.length;
  const pior = scores[0];
  const melhor = scores[scores.length - 1];
  const dadosDonut = (["A", "B", "C", "D"] as const).map((g) => ({ name: g, value: contagem[g] }));

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniKpi label="⭐ Score médio da rede" valor={scoreMedio.toFixed(1)} />
        <MiniKpi label="✅ Melhor posto" valor={`${melhor.razaoSocial ?? melhor.cnpj} (${melhor.score.toFixed(1)})`} />
        <MiniKpi label="⚠️ Precisa de atenção" valor={`${pior.razaoSocial ?? pior.cnpj} (${pior.score.toFixed(1)})`} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">Distribuição de graus</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={dadosDonut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} label={(entry) => `${entry.name} ${entry.value}`}>
                {dadosDonut.map((d) => (
                  <Cell key={d.name} fill={CORES_GRADE[d.name]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} postos`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col justify-center gap-2 text-sm">
          {(["A", "B", "C", "D"] as const).map((g) => (
            <div key={g} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CORES_GRADE[g] }} />
              <span className="font-medium text-slate-700">Grau {g}</span>
              <span className="text-slate-500">— {contagem[g]} posto(s)</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mb-2 text-xs font-medium text-slate-600">Score por posto (piores primeiro)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3">Posto</th>
              <th className="py-2 pr-3">Município/UF</th>
              <th className="py-2 pr-3">Combustível base</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2">Grau</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scores.map((s) => (
              <tr key={s.cnpj}>
                <td className="py-2 pr-3 text-slate-700">{s.razaoSocial ?? s.cnpj}</td>
                <td className="py-2 pr-3 text-slate-600">
                  {s.municipio}/{s.uf}
                </td>
                <td className="py-2 pr-3 text-slate-600">{s.combustivel}</td>
                <td className="py-2 pr-3 tabular-nums font-medium text-slate-900">{s.score.toFixed(1)}</td>
                <td className="py-2" style={{ color: CORES_GRADE[s.grade] }}>
                  <strong>{s.grade}</strong>
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
