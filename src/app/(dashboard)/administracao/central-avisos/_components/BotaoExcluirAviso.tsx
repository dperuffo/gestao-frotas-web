"use client";

import { useTransition } from "react";
import { excluirAvisoAcao } from "../actions";

export function BotaoExcluirAviso({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir este aviso? Não pode ser desfeito.")) return;
    startTransition(async () => {
      await excluirAvisoAcao(id);
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
