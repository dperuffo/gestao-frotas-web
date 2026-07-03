"use client";

import { useTransition } from "react";
import { alternarAtivoUsuario } from "../actions";

export function ToggleAtivoUsuario({ email, ativo }: { email: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoUsuario(email, !ativo);
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
