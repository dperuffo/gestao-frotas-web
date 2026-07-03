"use client";

import { useState, useTransition } from "react";
import { registrarRevogacaoConsentimento } from "../actions";

export function BotaoRevogarConsentimento() {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  function handleClick() {
    startTransition(async () => {
      const resultado = await registrarRevogacaoConsentimento();
      if (resultado?.erro) setMensagem({ tipo: "erro", texto: resultado.erro });
      else if (resultado?.sucesso) setMensagem({ tipo: "sucesso", texto: resultado.sucesso });
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={isPending} className="btn-secondary text-sm disabled:opacity-50">
        {isPending ? "Registrando..." : "Revogar consentimento"}
      </button>
      {mensagem && (
        <p className={`mt-2 text-xs ${mensagem.tipo === "erro" ? "text-red-600" : "text-emerald-600"}`}>{mensagem.texto}</p>
      )}
    </div>
  );
}
