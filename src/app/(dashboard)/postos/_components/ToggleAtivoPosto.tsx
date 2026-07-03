"use client";

import { useTransition } from "react";
import { bloquearPosto, desbloquearPosto } from "../actions";

export function ToggleAtivoPosto({ cnpj, ativo }: { cnpj: string; ativo: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          if (ativo) await bloquearPosto(cnpj);
          else await desbloquearPosto(cnpj);
        });
      }}
      className={ativo ? "btn-secondary" : "btn-primary"}
    >
      {isPending ? "Salvando..." : ativo ? "Bloquear para abastecimento" : "Desbloquear para abastecimento"}
    </button>
  );
}
