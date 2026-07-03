"use client";

import { useTransition } from "react";
import { excluirPreco } from "../actions";

export function ExcluirPreco({ id, cnpj }: { id: number; cnpj: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Excluir este registro de preço?")) return;
    startTransition(async () => {
      await excluirPreco(id, cnpj);
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
