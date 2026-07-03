"use client";

import { useTransition } from "react";
import { alternarAtivoCliente } from "../actions";

export function ToggleAtivoCliente({ id, ativo }: { id: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoCliente(id, !ativo);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : ativo ? "Suspender" : "Ativar"}
    </button>
  );
}
