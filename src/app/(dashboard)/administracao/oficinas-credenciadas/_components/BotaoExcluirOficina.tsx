"use client";

import { useTransition } from "react";
import { excluirOficinaAcao } from "../actions";

export function BotaoExcluirOficina({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta oficina credenciada? Não pode ser desfeito.")) return;
    startTransition(async () => {
      await excluirOficinaAcao(id);
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
