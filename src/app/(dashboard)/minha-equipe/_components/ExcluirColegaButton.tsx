"use client";

import { useState, useTransition } from "react";
import { removerColegaAcao } from "../actions";

// Fase editar-excluir-colega — diferente de "Inativar" (ToggleAtivoColega,
// mantém o vínculo e o histórico, só marca ativo=false), este remove o
// vínculo de vez e libera a vaga do plano — por isso o confirm() extra,
// mais enfático que o das outras ações desta tela.
export function ExcluirColegaButton({ empresaId, email }: { empresaId: string; email: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Excluir ${email} da equipe? Ele(a) perde o acesso e a vaga do plano é liberada. Essa ação não pode ser desfeita — se precisar, será um novo convite depois.`
      )
    )
      return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await removerColegaAcao(empresaId, email);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : "Excluir"}
      </button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </span>
  );
}
