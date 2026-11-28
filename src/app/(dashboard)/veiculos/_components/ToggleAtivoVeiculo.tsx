"use client";

import { useState, useTransition } from "react";
import { alternarAtivoVeiculo } from "../actions";

export function ToggleAtivoVeiculo({ id, ativo }: { id: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleClick() {
    setErro(null);
    startTransition(async () => {
      const r = await alternarAtivoVeiculo(id, !ativo);
      if (r.erro) setErro(r.erro);
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : ativo ? "Inativar" : "Ativar"}
      </button>
      {erro && (
        <span role="alert" className="mt-1 max-w-[16rem] text-xs text-red-600 dark:text-red-400">
          {erro}
        </span>
      )}
    </span>
  );
}
