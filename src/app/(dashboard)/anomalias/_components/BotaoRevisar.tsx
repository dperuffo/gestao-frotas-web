"use client";

import { useTransition } from "react";
import { marcarAnomaliaRevisadaAcao, desfazerRevisaoAnomaliaAcao } from "../actions";

// Fase 27.46 — marca/desmarca uma anomalia como revisada. Ação por item (não
// "marcar tudo") — cada achado merece um olhar antes de ser arquivado.
export function BotaoRevisar({ id, revisada }: { id: number; revisada: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      if (revisada) {
        await desfazerRevisaoAnomaliaAcao(id);
      } else {
        await marcarAnomaliaRevisadaAcao(id);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={revisada ? "text-xs font-medium text-slate-400 hover:underline" : "text-xs font-medium text-frota-600 hover:underline"}
    >
      {isPending ? "..." : revisada ? "Desfazer" : "Marcar como revisado"}
    </button>
  );
}
