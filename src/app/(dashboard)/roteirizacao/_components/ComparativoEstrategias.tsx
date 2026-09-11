"use client";

import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

import { CORES_GRADE } from "@/lib/scorePosto";
import type { ComparativoEstrategia } from "../actions";

// Mostra as 4 estratégias de otimização lado a lado (mesma rota, mesmos
// postos candidatos, só muda o peso preço/score/desvio) — ajuda o gestor a
// ver quanto custaria escolher outra estratégia sem precisar recalcular
// manualmente. Porta a seção "⚖️ Comparativo de Estratégias" do Streamlit.
export function ComparativoEstrategias({
  comparativo,
  selecionada,
}: {
  comparativo: ComparativoEstrategia[];
  selecionada: string;
}) {
  if (comparativo.length === 0) return null;

  const custosValidos = comparativo.map((c) => c.custoTotal).filter((c) => c > 0);
  const economia = custosValidos.length > 1 ? Math.max(...custosValidos) - Math.min(...custosValidos) : 0;

  return (
    <div className="mb-6">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
        ⚖️ Comparativo de Estratégias <AjudaIcon chave="roteirizacao.comparativo_estrategias" />
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        {comparativo.map((c) => {
          const ativa = c.chave === selecionada;
          return (
            <div
              key={c.chave}
              className={`rounded-xl border p-3 text-center ${
                ativa ? "border-frota-600 bg-frota-50 ring-1 ring-frota-600" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
              }`}
            >
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {c.icone} {c.nome} {ativa && <span className="text-frota-600">✓</span>}
              </p>
              <p className="mt-2 text-lg font-bold text-emerald-700">
                {c.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.numParadas} parada(s)</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{c.litrosTotal} L</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grade média:{" "}
                <span style={{ color: CORES_GRADE[c.gradeMedia] }} className="font-semibold">
                  {c.gradeMedia}
                </span>
              </p>
              {c.precoMedioPago != null && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {c.precoMedioPago.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    minimumFractionDigits: 3,
                  })}
                  /L
                </p>
              )}
            </div>
          );
        })}
      </div>
      {economia > 0.5 && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          💡 A diferença entre a estratégia mais econômica e a menos econômica é de{" "}
          <strong>{economia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong> nesta rota.
        </p>
      )}
    </div>
  );
}
