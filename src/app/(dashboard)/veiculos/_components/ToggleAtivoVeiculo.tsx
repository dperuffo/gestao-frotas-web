"use client";

import { useTransition } from "react";
import { alternarAtivoVeiculo } from "../actions";

export function ToggleAtivoVeiculo({ id, ativo }: { id: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoVeiculo(id, !ativo);
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
