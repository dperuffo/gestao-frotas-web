"use client";

import { useTransition } from "react";
import { atualizarStatusResgateProprio } from "../actions";

const OPCOES = [
  { valor: "solicitado", label: "Solicitado" },
  { valor: "em_andamento", label: "Em andamento" },
  { valor: "concluido", label: "Concluído" },
  { valor: "cancelado", label: "Cancelado" },
] as const;

export function AtualizarStatusResgateProprio({
  id,
  empresaId,
  status,
}: {
  id: string;
  empresaId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novoStatus = e.target.value;
    // "Solicitado" fica desabilitado nas opções — é só o estado inicial,
    // não faz sentido o posto/cliente voltar pra ele (ver actions.ts).
    if (novoStatus === "solicitado") return;
    startTransition(async () => {
      await atualizarStatusResgateProprio(id, empresaId, novoStatus);
    });
  }

  return (
    <select value={status} onChange={handleChange} disabled={isPending} className="input text-xs disabled:opacity-50">
      {OPCOES.map((o) => (
        <option key={o.valor} value={o.valor} disabled={o.valor === "solicitado"}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
