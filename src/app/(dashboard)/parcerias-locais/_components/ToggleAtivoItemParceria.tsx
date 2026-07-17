"use client";

import { useTransition } from "react";
import { alternarAtivoItemParceria } from "../actions";

export function ToggleAtivoItemParceria({ id, empresaId, ativo }: { id: string; empresaId: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoItemParceria(id, empresaId, !ativo);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : ativo ? "Inativar" : "Ativar"}
    </button>
  );
}
