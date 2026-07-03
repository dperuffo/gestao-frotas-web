"use client";

import { useTransition } from "react";
import { marcarExclusaoExecutada } from "../actions";

export function BotaoMarcarExecutada({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await marcarExclusaoExecutada(id);
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50">
      {isPending ? "..." : "Marcar como executada"}
    </button>
  );
}
