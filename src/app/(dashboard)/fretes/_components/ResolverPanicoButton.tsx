"use client";

import { useTransition } from "react";
import { resolverAlertaPanicoAcao } from "../actions";

// Fase Resolver-Panico (02/08/2026, pedido do Daniel) — gestor marca o
// alerta de pânico como verificado/sanado. Pede uma observação opcional
// (o que foi verificado, ex.: "liguei pro motorista, era só um pneu furado")
// pra ficar registrado junto — não apaga o evento, só marca a resolução.
export function ResolverPanicoButton({ freteId, eventoId }: { freteId: string; eventoId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Marcar esse alerta de emergência como verificado/sanado?")) return;
    const observacao = window.prompt("O que foi verificado? (opcional)") ?? null;
    startTransition(async () => {
      await resolverAlertaPanicoAcao(freteId, eventoId, observacao?.trim() || null);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
    >
      {isPending ? "..." : "Marcar como resolvido"}
    </button>
  );
}
