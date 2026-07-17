"use client";

import { useTransition } from "react";
import { reabrirFreteParaMercado } from "../actions";

export function ReabrirFreteButton({ id, empresaId }: { id: string; empresaId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await reabrirFreteParaMercado(id, empresaId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="font-medium text-frota-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : "Abrir pro mercado"}
    </button>
  );
}
