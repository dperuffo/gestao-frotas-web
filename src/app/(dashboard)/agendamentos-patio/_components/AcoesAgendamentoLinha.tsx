"use client";

import { useTransition } from "react";
import { confirmarAgendamentoAcao, cancelarAgendamentoAcao } from "../actions";

export function AcoesAgendamentoLinha({ id, freteId, status }: { id: string; freteId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  if (!["agendado", "confirmado"].includes(status)) return null;

  return (
    <span className="flex items-center gap-2">
      {status === "agendado" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => confirmarAgendamentoAcao(id, freteId))}
          className="text-xs text-blue-600 hover:underline"
        >
          Confirmar
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (confirm("Cancelar este agendamento?")) startTransition(() => cancelarAgendamentoAcao(id, freteId));
        }}
        className="text-xs text-red-600 hover:underline"
      >
        Cancelar
      </button>
    </span>
  );
}
