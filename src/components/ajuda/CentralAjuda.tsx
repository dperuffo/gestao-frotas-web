"use client";

import { useState } from "react";
import Link from "next/link";
import { useTour } from "./TourProvider";

// Botão fixo no rodapé da barra lateral (Fase 24) — "chamado a qualquer
// momento" (pedido do Daniel): reabre o tour guiado de boas-vindas e dá um
// lembrete rápido de onde achar ajuda contextual (ícones "?") e o
// Assistente FNI pra perguntas livres sobre os dados.
export function CentralAjuda() {
  const [aberto, setAberto] = useState(false);
  const { iniciar } = useTour();

  return (
    <>
      <button
        type="button"
        data-tour="central-ajuda"
        onClick={() => setAberto(true)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
      >
        🎓 Central de Ajuda
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-frota-950/70 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="text-sm font-semibold text-slate-900">Central de Ajuda</h2>
            <p className="mt-2 text-sm text-slate-600">
              Em quase todo indicador e painel do sistema, procure o ícone{" "}
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-400">
                ?
              </span>{" "}
              — ele explica o que aquele número significa e como é calculado.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Pra dúvidas livres sobre os dados da sua frota — ou sobre como usar qualquer tela da
              plataforma — use o{" "}
              <Link href="/assistente" className="text-frota-600 hover:underline" onClick={() => setAberto(false)}>
                Assistente FNI
              </Link>
              .
            </p>
            <p className="mt-2 text-sm text-slate-600">
              E, pra um passo a passo mais completo por módulo (com imagens de tela), veja a{" "}
              <Link href="/treinamento" className="text-frota-600 hover:underline" onClick={() => setAberto(false)}>
                Central de Treinamento
              </Link>
              .
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAberto(false);
                  iniciar();
                }}
                className="btn-secondary text-xs"
              >
                Rever o tour de boas-vindas
              </button>
              <button type="button" onClick={() => setAberto(false)} className="btn-primary text-xs">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
