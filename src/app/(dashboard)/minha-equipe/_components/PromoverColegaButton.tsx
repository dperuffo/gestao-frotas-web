"use client";

import { useState, useTransition } from "react";
import { promoverColega } from "../actions";

export function PromoverColegaButton({ empresaId, email, rotuloDestino }: { empresaId: string; email: string; rotuloDestino: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Promover ${email} a ${rotuloDestino}? Ele(a) passa a ter acesso total à empresa.`)) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await promoverColega(empresaId, email);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : `Promover a ${rotuloDestino}`}
      </button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </span>
  );
}
