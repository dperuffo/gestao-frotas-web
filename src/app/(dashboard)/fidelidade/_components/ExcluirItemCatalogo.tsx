"use client";

import { useTransition } from "react";
import { excluirItemCatalogo } from "../actions";

export function ExcluirItemCatalogo({ id, titulo }: { id: string; titulo: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Excluir o item "${titulo}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(() => {
      excluirItemCatalogo(id);
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
