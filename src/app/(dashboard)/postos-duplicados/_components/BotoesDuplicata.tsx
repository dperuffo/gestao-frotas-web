"use client";

import { useState, useTransition } from "react";
import { descartarDuplicataAcao, confirmarDuplicataAcao } from "../actions";

export function BotoesDuplicata({ id }: { id: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [resolvido, setResolvido] = useState<"descartado" | "confirmado_duplicata" | undefined>();
  const [isPending, startTransition] = useTransition();

  function descartar() {
    setErro(undefined);
    startTransition(async () => {
      const r = await descartarDuplicataAcao(id);
      if (r.erro) setErro(r.erro);
      else setResolvido("descartado");
    });
  }

  function confirmar() {
    setErro(undefined);
    startTransition(async () => {
      const r = await confirmarDuplicataAcao(id);
      if (r.erro) setErro(r.erro);
      else setResolvido("confirmado_duplicata");
    });
  }

  if (resolvido === "descartado") {
    return <p className="mt-2 text-xs font-medium text-slate-500">✓ Descartado — não é duplicata.</p>;
  }
  if (resolvido === "confirmado_duplicata") {
    return <p className="mt-2 text-xs font-medium text-red-700">✓ Confirmado como duplicata.</p>;
  }

  return (
    <div className="mt-2">
      {erro && <p className="mb-1 text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={descartar} disabled={isPending} className="btn-secondary text-xs">
          Não é duplicata
        </button>
        <button type="button" onClick={confirmar} disabled={isPending} className="btn-primary text-xs">
          Confirmar duplicata
        </button>
      </div>
    </div>
  );
}
