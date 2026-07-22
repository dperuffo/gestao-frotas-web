"use client";

import { useTransition } from "react";
import { alternarAtivoTabelaFrete } from "../actions";

export function AlternarAtivoTabela({ id, empresaId, ativo }: { id: string; empresaId: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarAtivoTabelaFrete(id, empresaId, !ativo);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`text-xs font-medium hover:underline disabled:opacity-50 ${ativo ? "text-slate-500" : "text-status-ativo"}`}
    >
      {isPending ? "..." : ativo ? "Desativar" : "Ativar"}
    </button>
  );
}
