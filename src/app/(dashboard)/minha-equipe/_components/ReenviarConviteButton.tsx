"use client";

import { useState, useTransition } from "react";
import { reenviarConviteColegaAcao } from "../actions";

// Fase melhora-fluxo-convite (27/07/2026) — cobre o colega que ficou
// travado no meio do convite (ex.: template antigo do e-mail, ou simplesmente
// perdeu/apagou o e-mail original). Diferente de "Convidar colega" (que
// pula o envio pra quem já tem conta), este força um reenvio de verdade.
export function ReenviarConviteButton({ empresaId, email }: { empresaId: string; email: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setErro(undefined);
    setSucesso(undefined);
    startTransition(async () => {
      const resultado = await reenviarConviteColegaAcao(empresaId, email);
      if (resultado?.erro) setErro(resultado.erro);
      if (resultado?.sucesso) setSucesso(resultado.sucesso);
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : "Reenviar convite"}
      </button>
      {erro && <span className="max-w-[220px] text-right text-xs text-red-600">{erro}</span>}
      {sucesso && <span className="text-xs text-green-600">{sucesso}</span>}
    </span>
  );
}
