"use client";

import { useTransition } from "react";
import { excluirApoliceAcao } from "../actions";

export function ExcluirApolice({ id, numero }: { id: string; numero: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Excluir a apólice "${numero}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(() => {
      excluirApoliceAcao(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : "Excluir"}
    </button>
  );
}
