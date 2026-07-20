"use client";

import { useTransition } from "react";
import { excluirConteudoAcao } from "../actions";

export function BotaoExcluirConteudo({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta entrada de ajuda/treinamento? Não pode ser desfeito.")) return;
    startTransition(async () => {
      await excluirConteudoAcao(id);
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
