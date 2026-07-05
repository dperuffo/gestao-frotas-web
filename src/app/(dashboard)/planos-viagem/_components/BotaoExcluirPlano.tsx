"use client";

import { useState, useTransition } from "react";
import { excluirPlanoViagem } from "../actions";

export function BotaoExcluirPlano({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="text-red-600 hover:underline">
        Excluir
      </button>
    );
  }

  function handleExcluir() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await excluirPlanoViagem(id);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {erro ? (
        <span className="text-red-600">{erro}</span>
      ) : (
        <span className="text-slate-500">Confirma?</span>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={handleExcluir}
        className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "..." : "Sim"}
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="text-slate-500 hover:underline">
        Cancelar
      </button>
    </div>
  );
}
