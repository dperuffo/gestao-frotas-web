"use client";

import { useTransition } from "react";
import { excluirRegraAntifraude } from "../actions";

export function ExcluirRegraAntifraude({ id, nome }: { id: string; nome: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Excluir a regra "${nome}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(() => {
      excluirRegraAntifraude(id);
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
