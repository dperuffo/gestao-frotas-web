"use client";

import { useTransition } from "react";
import { ativarPosto, bloquearPosto, desbloquearPosto } from "../actions";

export function AcaoPosto({
  cnpj,
  empresaId,
  estaNaRede,
  ativo,
}: {
  cnpj: string;
  empresaId: string | null;
  estaNaRede: boolean;
  ativo: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!estaNaRede) {
    return (
      <button
        type="button"
        disabled={isPending || !empresaId}
        title={empresaId ? undefined : "Selecione um cliente para ativar este posto"}
        onClick={() => {
          if (!empresaId) return;
          startTransition(async () => {
            await ativarPosto(cnpj, empresaId);
          });
        }}
        className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "Ativando..." : "+ Ativar"}
      </button>
    );
  }

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
      className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : ativo ? "Bloquear" : "Desbloquear"}
    </button>
  );
}
