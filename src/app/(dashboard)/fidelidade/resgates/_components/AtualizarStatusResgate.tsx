"use client";

import { useTransition } from "react";
import { atualizarStatusResgate } from "../../actions";

const OPCOES = [
  { valor: "solicitado", label: "Solicitado" },
  { valor: "em_andamento", label: "Em andamento" },
  { valor: "concluido", label: "Concluído" },
  { valor: "cancelado", label: "Cancelado" },
] as const;

export function AtualizarStatusResgate({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novoStatus = e.target.value;
    startTransition(async () => {
      await atualizarStatusResgate(id, novoStatus);
    });
  }

  return (
    <select value={status} onChange={handleChange} disabled={isPending} className="input text-xs disabled:opacity-50">
      {OPCOES.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
