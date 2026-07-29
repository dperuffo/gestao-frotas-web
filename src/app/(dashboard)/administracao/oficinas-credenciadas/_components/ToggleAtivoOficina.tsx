"use client";

import { useTransition } from "react";
import { alternarAtivoOficinaAcao } from "../actions";

export function ToggleAtivoOficina({ id, ativo }: { id: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoOficinaAcao(id, !ativo);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : ativo ? "Desativar" : "Ativar"}
    </button>
  );
}
