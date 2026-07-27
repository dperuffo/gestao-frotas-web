"use client";

import { useTransition } from "react";
import { alternarAtivoColega } from "../actions";

export function ToggleAtivoColega({ empresaId, email, ativo }: { empresaId: string; email: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoColega(empresaId, email, !ativo);
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
