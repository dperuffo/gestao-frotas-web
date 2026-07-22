"use client";

import { useTransition } from "react";
import { descartarCotacaoAcao } from "../actions";

export function DescartarCotacaoButton({ id, empresaId }: { id: string; empresaId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Descartar esta cotação? Ela continua no histórico, mas marcada como descartada.")) return;
    startTransition(async () => {
      await descartarCotacaoAcao(id, empresaId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : "Descartar"}
    </button>
  );
}
