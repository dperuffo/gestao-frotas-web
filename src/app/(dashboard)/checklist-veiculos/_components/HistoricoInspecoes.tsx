"use client";

import { useTransition } from "react";
import { resolverItemInspecaoAcao, excluirInspecaoAcao } from "../actions";
import { formatDate } from "@/lib/utils";

type Item = {
  id: number;
  item: string;
  critico: boolean;
  conforme: boolean;
  observacao: string | null;
  resolvido_em: string | null;
  resolvido_por: string | null;
};

type Inspecao = {
  id: number;
  data_inspecao: string;
  hodometro: number | null;
  responsavel: string | null;
  criado_por: string | null;
  itens: Item[];
};

// Fase Indicadores-da-Frota — Checklist (30/07/2026). Duas visões da mesma
// base: pendências abertas em destaque no topo (itens não conformes ainda
// sem resolvido_em, é o que alimenta o TMRNC) e o histórico completo abaixo
// pra auditoria, mesmo espírito de HistoricoManutencoes.
export function HistoricoInspecoes({ placa, inspecoes }: { placa: string; inspecoes: Inspecao[] }) {
  const [isPending, startTransition] = useTransition();

  const pendencias = inspecoes.flatMap((insp) =>
    insp.itens
      .filter((it) => !it.conforme && !it.resolvido_em)
      .map((it) => ({ ...it, dataInspecao: insp.data_inspecao, inspecaoId: insp.id }))
  );

  function handleResolver(id: number) {
    startTransition(async () => {
      try {
        await resolverItemInspecaoAcao(id, placa);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Erro ao marcar como resolvida.");
      }
    });
  }

  function handleExcluir(id: number) {
    if (!confirm("Excluir esta inspeção e todos os seus itens?")) return;
    startTransition(async () => {
      try {
        await excluirInspecaoAcao(id, placa);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Erro ao excluir.");
      }
    });
  }

  if (inspecoes.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">Nenhuma inspeção registrada ainda.</p>;
  }

  return (
    <div className="space-y-6">
      {pendencias.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-red-700">⚠️ Pendências abertas ({pendencias.length})</h3>
          <div className="space-y-2">
            {pendencias.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-red-800">{p.item}</span>
                  {p.critico && <span className="ml-1.5 text-[10px] font-medium text-amber-700">crítico</span>}
                  <span className="ml-2 text-red-600">desde {formatDate(p.dataInspecao)}</span>
                  {p.observacao && <p className="mt-0.5 text-xs text-red-600">{p.observacao}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleResolver(p.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100"
                >
                  Marcar resolvida
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Histórico de inspeções</h3>
        <div className="space-y-3">
          {inspecoes.map((insp) => {
            const naoConformes = insp.itens.filter((it) => !it.conforme);
            return (
              <details key={insp.id} className="rounded-lg border border-slate-200 p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700">
                    {formatDate(insp.data_inspecao)}
                    {insp.hodometro ? ` · ${insp.hodometro.toLocaleString("pt-BR")} km` : ""}
                    {insp.responsavel ? ` · ${insp.responsavel}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    {naoConformes.length > 0 ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        {naoConformes.length} não conforme(s)
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Tudo conforme</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleExcluir(insp.id);
                      }}
                      disabled={isPending}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </span>
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {insp.itens.map((it) => (
                    <div key={it.id} className="flex items-center gap-1.5 text-xs">
                      <span className={it.conforme ? "text-emerald-600" : "text-red-600"}>{it.conforme ? "✓" : "✗"}</span>
                      <span className="text-slate-600">{it.item}</span>
                      {it.observacao && <span className="text-slate-400">— {it.observacao}</span>}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
