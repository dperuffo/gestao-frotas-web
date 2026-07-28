"use client";

import { useTransition } from "react";
import { alternarAtivoAvisoAcao } from "../actions";

export function ToggleAtivoAviso({ id, ativo }: { id: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoAvisoAcao(id, !ativo);
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
