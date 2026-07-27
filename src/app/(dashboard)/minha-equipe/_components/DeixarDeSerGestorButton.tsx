"use client";

import { useState, useTransition } from "react";
import { autoRebaixarParaColaborador } from "../actions";

export function DeixarDeSerGestorButton({ empresaId }: { empresaId: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Deixar de ser gestor desta empresa? Você passa a ter acesso de colaborador, definido em Permissões.")) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await autoRebaixarParaColaborador(empresaId);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium text-slate-500 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : "Deixar de ser gestor"}
      </button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </span>
  );
}
