"use client";

import { useMemo, useState } from "react";
import { formatarDataBr } from "@/lib/utils";

export type RegistroHistorico = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  combustivel: string;
  dataRef: string;
  preco: number;
};

function formatarMoeda(v: number, casas = 3) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function quantil(valoresOrdenados: number[], q: number) {
  if (valoresOrdenados.length === 0) return 0;
  const pos = (valoresOrdenados.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return valoresOrdenados[base + 1] !== undefined
    ? valoresOrdenados[base] + resto * (valoresOrdenados[base + 1] - valoresOrdenados[base])
    : valoresOrdenados[base];
}

// Detecção de preços fora do padrão via método IQR (interquartil) — mesma
// técnica do relatório de Anomalias no Streamlit de referência: por
// combustível, marca como outlier qualquer preço fora de
// [Q1 - 1.5·IQR, Q3 + 1.5·IQR]. Precisa de pelo menos 5 registros do
// combustível pra ter uma base estatística minimamente confiável.
export function Anomalias({ historico }: { historico: RegistroHistorico[] }) {
  const [combustivelFiltro, setCombustivelFiltro] = useState("");

  const outliers = useMemo(() => {
    const porCombustivel = new Map<string, RegistroHistorico[]>();
    for (const r of historico) {
      if (!porCombustivel.has(r.combustivel)) porCombustivel.set(r.combustivel, []);
      porCombustivel.get(r.combustivel)!.push(r);
    }

    const linhas: (RegistroHistorico & { mediana: number; deltaPct: number })[] = [];
    for (const [combustivel, registros] of porCombustivel.entries()) {
      if (registros.length < 5) continue;
      const precos = registros.map((r) => r.preco).sort((a, b) => a - b);
      const q1 = quantil(precos, 0.25);
      const q3 = quantil(precos, 0.75);
      const iqr = q3 - q1;
      const inferior = q1 - 1.5 * iqr;
      const superior = q3 + 1.5 * iqr;
      const mediana = quantil(precos, 0.5);
      for (const r of registros) {
        if (r.preco < inferior || r.preco > superior) {
          linhas.push({ ...r, mediana, deltaPct: mediana ? ((r.preco - mediana) / mediana) * 100 : 0 });
        }
      }
    }
    return linhas.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  }, [historico]);

  const combustiveis = useMemo(() => Array.from(new Set(outliers.map((o) => o.combustivel))).sort(), [outliers]);
  const outliersFiltrados = combustivelFiltro ? outliers.filter((o) => o.combustivel === combustivelFiltro) : outliers;

  // Postos inconsistentes: coeficiente de variação (CV) alto entre os
  // registros de um mesmo posto+combustível — indica preço instável/errático,
  // possível erro de digitação recorrente ou fonte de dado ruim.
  const postosInconsistentes = useMemo(() => {
    const porPostoCombustivel = new Map<string, RegistroHistorico[]>();
    for (const r of historico) {
      const chave = `${r.cnpj}__${r.combustivel}`;
      if (!porPostoCombustivel.has(chave)) porPostoCombustivel.set(chave, []);
      porPostoCombustivel.get(chave)!.push(r);
    }
    const linhas: { cnpj: string; razaoSocial: string | null; uf: string | null; combustivel: string; registros: number; cv: number }[] = [];
    for (const registros of porPostoCombustivel.values()) {
      if (registros.length < 3) continue;
      const precos = registros.map((r) => r.preco);
      const media = precos.reduce((a, b) => a + b, 0) / precos.length;
      const variancia = precos.reduce((s, p) => s + (p - media) ** 2, 0) / precos.length;
      const cv = media ? (Math.sqrt(variancia) / media) * 100 : 0;
      if (cv > 5) {
        linhas.push({
          cnpj: registros[0].cnpj,
          razaoSocial: registros[0].razaoSocial,
          uf: registros[0].uf,
          combustivel: registros[0].combustivel,
          registros: registros.length,
          cv,
        });
      }
    }
    return linhas.sort((a, b) => b.cv - a.cv);
  }, [historico]);

  if (historico.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Ainda não há histórico de preços suficiente pra detectar anomalias.</p>;
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">
        Detecta preços fora do padrão (método estatístico IQR) e postos com comportamento inconsistente —
        útil para achar erro de digitação, dado ruim ou variação suspeita entre cargas.
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">💲 Preços fora do padrão ({outliers.length})</h3>
          {combustiveis.length > 1 && (
            <select value={combustivelFiltro} onChange={(e) => setCombustivelFiltro(e.target.value)} className="input w-auto text-sm">
              <option value="">Todos os combustíveis</option>
              {combustiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
        {outliersFiltrados.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum preço fora do padrão identificado.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Posto</th>
                  <th className="py-2 pr-3">Município/UF</th>
                  <th className="py-2 pr-3">Combustível</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Preço</th>
                  <th className="py-2 pr-3">Mediana do combustível</th>
                  <th className="py-2">Desvio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outliersFiltrados.slice(0, 200).map((o, i) => (
                  <tr key={`${o.cnpj}__${o.combustivel}__${o.dataRef}__${i}`}>
                    <td className="py-2 pr-3 text-slate-700">{o.razaoSocial ?? o.cnpj}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {o.municipio}/{o.uf}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{o.combustivel}</td>
                    <td className="py-2 pr-3 text-slate-600">{formatarDataBr(o.dataRef)}</td>
                    <td className="py-2 pr-3 tabular-nums font-medium text-slate-900">{formatarMoeda(o.preco)}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-500">{formatarMoeda(o.mediana)}</td>
                    <td className={`py-2 tabular-nums font-medium ${o.deltaPct >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {o.deltaPct >= 0 ? "+" : ""}
                      {o.deltaPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {outliersFiltrados.length > 200 && (
              <p className="mt-2 text-xs text-slate-400">Mostrando os 200 desvios mais fortes de {outliersFiltrados.length}.</p>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">🏭 Postos inconsistentes ({postosInconsistentes.length})</h3>
        <p className="mb-3 text-xs text-slate-400">
          Coeficiente de variação (CV) acima de 5% entre os registros do mesmo posto+combustível — preço instável.
        </p>
        {postosInconsistentes.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum posto com variação suspeita identificado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Posto</th>
                  <th className="py-2 pr-3">UF</th>
                  <th className="py-2 pr-3">Combustível</th>
                  <th className="py-2 pr-3">Registros</th>
                  <th className="py-2">CV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {postosInconsistentes.slice(0, 50).map((p, i) => (
                  <tr key={`${p.cnpj}__${p.combustivel}__${i}`}>
                    <td className="py-2 pr-3 text-slate-700">{p.razaoSocial ?? p.cnpj}</td>
                    <td className="py-2 pr-3 text-slate-600">{p.uf}</td>
                    <td className="py-2 pr-3 text-slate-600">{p.combustivel}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{p.registros}</td>
                    <td className="py-2 tabular-nums font-medium text-red-600">{p.cv.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
