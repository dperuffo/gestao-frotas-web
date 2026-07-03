"use client";

import { useTransition } from "react";
import { atualizarChamadoAcao } from "../actions";

export function BotaoResolverChamado({ ticketId }: { ticketId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-6">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await atualizarChamadoAcao(ticketId, { status: "resolvido" }); })}
        className="btn-secondary text-sm disabled:opacity-50"
      >
        {pending ? "Salvando..." : "✓ Marcar como resolvido"}
      </button>
    </div>
  );
}
