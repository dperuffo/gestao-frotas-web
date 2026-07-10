"use client";

import { useTransition } from "react";

// Fase 27.121 — botões de Ativar/Inativar e Excluir reaproveitados pelos 9
// tipos de regra novos, cada um passando sua própria Server Action (mesmo
// formato de alternarStatusVinculo/excluirVinculo da Fase 27.120).
export function ToggleStatusRegra({
  id,
  ativo,
  acao,
}: {
  id: string;
  ativo: boolean;
  acao: (id: string, ativo: boolean) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => acao(id, !ativo))}
      disabled={isPending}
      className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : ativo ? "Inativar" : "Ativar"}
    </button>
  );
}

export function ExcluirRegra({ id, acao }: { id: string; acao: (id: string) => Promise<void> }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("Excluir esta regra? Esta ação não pode ser desfeita.")) {
          startTransition(() => acao(id));
        }
      }}
      disabled={isPending}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : "Excluir"}
    </button>
  );
}
