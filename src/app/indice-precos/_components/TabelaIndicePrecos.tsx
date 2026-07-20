"use client";

import { useMemo, useState } from "react";

export type LinhaIndicePreco = {
  uf: string;
  combustivel: string;
  preco_medio_rede: number;
  preco_min_rede: number;
  preco_max_rede: number;
  qtd_postos: number;
  preco_medio_anp: number | null;
  atualizado_em: string | null;
};

const COMBUSTIVEL_LABEL: Record<string, string> = {
  "OLEO DIESEL": "Diesel Comum",
  "OLEO DIESEL S10": "Diesel S10",
  "ETANOL HIDRATADO": "Etanol",
  "GASOLINA COMUM": "Gasolina Comum",
  "GASOLINA ADITIVADA": "Gasolina Aditivada",
  GNV: "GNV",
  GLP: "GLP",
};

function formatarPreco(valor: number | null) {
  if (valor === null || valor === undefined) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 });
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

// Fase Índice-Público-de-Preço — item #3 de alta prioridade do benchmark
// TicketLog. Tabela client-side simples (filtro por UF/combustível em cima
// de dados já buscados no servidor) — não precisa de round-trip novo ao
// Supabase a cada filtro, a base de dados (uf x combustível) já é pequena o
// bastante (poucas centenas de linhas) pra filtrar em memória.
export function TabelaIndicePrecos({ linhas }: { linhas: LinhaIndicePreco[] }) {
  const [uf, setUf] = useState("");
  const [combustivel, setCombustivel] = useState("");

  const ufs = useMemo(() => Array.from(new Set(linhas.map((l) => l.uf))).sort(), [linhas]);
  const combustiveis = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.combustivel))).sort(),
    [linhas]
  );

  const filtradas = linhas.filter(
    (l) => (!uf || l.uf === uf) && (!combustivel || l.combustivel === combustivel)
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="" className="text-slate-900">
            Todos os estados
          </option>
          {ufs.map((valor) => (
            <option key={valor} value={valor} className="text-slate-900">
              {valor}
            </option>
          ))}
        </select>
        <select
          value={combustivel}
          onChange={(e) => setCombustivel(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="" className="text-slate-900">
            Todos os combustíveis
          </option>
          {combustiveis.map((valor) => (
            <option key={valor} value={valor} className="text-slate-900">
              {COMBUSTIVEL_LABEL[valor] ?? valor}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-300">
            <tr>
              <th className="px-4 py-3">UF</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Preço médio (rede GF)</th>
              <th className="px-4 py-3">Referência ANP</th>
              <th className="px-4 py-3">Diferença</th>
              <th className="px-4 py-3">Postos amostrados</th>
              <th className="px-4 py-3">Atualizado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtradas.map((l, i) => {
              const diffPct =
                l.preco_medio_anp && l.preco_medio_anp > 0
                  ? ((l.preco_medio_rede - l.preco_medio_anp) / l.preco_medio_anp) * 100
                  : null;
              return (
                <tr key={`${l.uf}-${l.combustivel}-${i}`} className="text-slate-200">
                  <td className="px-4 py-3 font-medium">{l.uf}</td>
                  <td className="px-4 py-3">{COMBUSTIVEL_LABEL[l.combustivel] ?? l.combustivel}</td>
                  <td className="px-4 py-3 tabular-nums">{formatarPreco(l.preco_medio_rede)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-400">{formatarPreco(l.preco_medio_anp)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {diffPct === null ? (
                      "—"
                    ) : (
                      <span className={diffPct <= 0 ? "text-emerald-400" : "text-amber-400"}>
                        {diffPct > 0 ? "+" : ""}
                        {diffPct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-400">{l.qtd_postos}</td>
                  <td className="px-4 py-3 text-slate-400">{formatarData(l.atualizado_em)}</td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum dado encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
