"use client";

import { useTransition } from "react";
import { alternarAtivoConteudoAcao } from "../actions";

export function ToggleAtivoConteudo({ id, ativo }: { id: number; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoConteudoAcao(id, !ativo);
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
