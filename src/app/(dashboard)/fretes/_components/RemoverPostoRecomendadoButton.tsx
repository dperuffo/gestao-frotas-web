"use client";

import { useTransition } from "react";
import { removerPostoRecomendadoAcao } from "../actions";

export function RemoverPostoRecomendadoButton({ id, freteId, empresaId }: { id: string; freteId: string; empresaId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => removerPostoRecomendadoAcao(id, freteId, empresaId))}
      disabled={isPending}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : "Remover"}
    </button>
  );
}
