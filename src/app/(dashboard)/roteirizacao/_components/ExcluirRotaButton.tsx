"use client";

import { useTransition } from "react";
import { excluirRotaSalvaAcao } from "../actions";

export function ExcluirRotaButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-50"
      onClick={() => {
        if (!confirm("Excluir esta consulta salva?")) return;
        startTransition(() => excluirRotaSalvaAcao(id));
      }}
    >
      {isPending ? "Excluindo..." : "Excluir"}
    </button>
  );
}
