"use client";

import { useTransition } from "react";
import { excluirTabelaFrete } from "../actions";

export function BotaoExcluirTabela({ id, empresaId }: { id: string; empresaId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta tabela de frete? As faixas de peso vinculadas também serão removidas.")) return;
    startTransition(async () => {
      await excluirTabelaFrete(id, empresaId);
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
