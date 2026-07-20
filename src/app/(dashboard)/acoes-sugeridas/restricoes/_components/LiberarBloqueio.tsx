"use client";

import { useTransition } from "react";
import { liberarBloqueioAbastecimentoAcao } from "../../actions";

export function LiberarBloqueio({ id, alvoLabel }: { id: number; alvoLabel: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(`Liberar o abastecimento de "${alvoLabel}"? Ela volta a poder abastecer normalmente.`)) return;
    startTransition(async () => {
      await liberarBloqueioAbastecimentoAcao(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : "Liberar"}
    </button>
  );
}
