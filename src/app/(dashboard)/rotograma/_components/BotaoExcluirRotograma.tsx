"use client";

import { useState, useTransition } from "react";
import { excluirRotogramaAcao } from "../actions";

export function BotaoExcluirRotograma({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="btn-secondary text-red-600">
        Excluir
      </button>
    );
  }

  function handleExcluir() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await excluirRotogramaAcao(id);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {erro ? (
        <span className="text-red-600">{erro}</span>
      ) : (
        <span className="text-slate-600">Confirma excluir este Rotograma?</span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={handleExcluir}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "Excluindo..." : "Sim, excluir"}
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="text-xs text-slate-500 hover:underline">
        Cancelar
      </button>
    </div>
  );
}
