"use client";

import { useTransition } from "react";
import { atualizarChamadoAcao } from "../actions";
import { PRIORIDADES_TICKET, STATUS_TICKET, type TicketPrioridade, type TicketStatus } from "@/lib/chamados";

// Controles de triagem — só aparecem pro admin (a página de detalhe decide
// isso, ver [id]/page.tsx). Gestor de cliente só tem o botão "Marcar como
// resolvido" (BotaoResolverChamado.tsx).
export function ControlesAdminChamado({
  ticketId,
  statusAtual,
  prioridadeAtual,
}: {
  ticketId: string;
  statusAtual: TicketStatus;
  prioridadeAtual: TicketPrioridade;
}) {
  const [pending, startTransition] = useTransition();

  function atualizar(dados: { status?: TicketStatus; prioridade?: TicketPrioridade }) {
    startTransition(async () => {
      await atualizarChamadoAcao(ticketId, dados);
    });
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
        <select
          defaultValue={statusAtual}
          disabled={pending}
          onChange={(e) => atualizar({ status: e.target.value as TicketStatus })}
          className="input text-sm"
        >
          {STATUS_TICKET.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Prioridade</label>
        <select
          defaultValue={prioridadeAtual}
          disabled={pending}
          onChange={(e) => atualizar({ prioridade: e.target.value as TicketPrioridade })}
          className="input text-sm"
        >
          {PRIORIDADES_TICKET.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {pending && <span className="text-xs text-slate-400">Salvando...</span>}
    </div>
  );
}
