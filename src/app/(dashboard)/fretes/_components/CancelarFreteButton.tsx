"use client";

import { useTransition } from "react";
import { cancelarFrete } from "../actions";

export function CancelarFreteButton({ id, empresaId }: { id: string; empresaId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Cancelar este frete?")) return;
    startTransition(async () => {
      await cancelarFrete(id, empresaId);
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className="font-medium text-red-600 hover:underline disabled:opacity-50">
      {isPending ? "..." : "Cancelar"}
    </button>
  );
}
