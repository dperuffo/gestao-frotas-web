"use client";

import { useTransition } from "react";
import { excluirPisoAntt } from "../actions";

export function BotaoExcluirPiso({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta faixa de piso ANTT? Não pode ser desfeito.")) return;
    startTransition(async () => {
      await excluirPisoAntt(id);
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
