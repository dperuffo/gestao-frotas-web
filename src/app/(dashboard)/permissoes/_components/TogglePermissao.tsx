"use client";

import { useTransition } from "react";
import { alternarPermissao } from "../actions";

export function TogglePermissao({
  funcionalidade,
  perfil,
  permitido,
  empresaId,
}: {
  funcionalidade: string;
  perfil: string;
  permitido: boolean;
  empresaId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await alternarPermissao(funcionalidade, perfil, !permitido, empresaId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={permitido ? "Clique para negar" : "Clique para permitir"}
      aria-pressed={permitido}
      className={`mx-auto flex h-6 w-11 items-center rounded-full border transition disabled:opacity-50 ${
        permitido ? "border-frota-600 bg-frota-600" : "border-slate-300 bg-slate-200"
      }`}
    >
      <span
        className={`h-4 w-4 transform rounded-full bg-white shadow transition ${
          permitido ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
