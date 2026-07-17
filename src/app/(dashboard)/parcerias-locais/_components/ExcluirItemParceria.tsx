"use client";

import { useTransition } from "react";
import { excluirItemParceria } from "../actions";

export function ExcluirItemParceria({ id, empresaId, titulo }: { id: string; empresaId: string; titulo: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Excluir o benefício "${titulo}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(() => {
      excluirItemParceria(id, empresaId);
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
