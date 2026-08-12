"use client";

import { useState, useTransition } from "react";
import { reprocessarNotasAntigasAcao, type ResultadoReprocessamento } from "../actions";

// Fase Apuracao-ICMS-Combustivel — reprocessa, a partir do XML já
// arquivado, as notas antigas que ainda não têm o valor de crédito
// extraído (ver comentário na action). Botão simples: mostra o resumo do
// que achou e deixa o cliente clicar de novo se sobrar mais (limite de 200
// por execução).
export function BotaoReprocessarNotas({ empresaId }: { empresaId: string }) {
  const [pendente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoReprocessamento | null>(null);

  function reprocessar() {
    setResultado(null);
    iniciar(async () => {
      const r = await reprocessarNotasAntigasAcao(empresaId);
      setResultado(r);
    });
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={reprocessar} disabled={pendente} className="btn-secondary text-xs">
        {pendente ? "Reprocessando..." : "Reprocessar notas antigas"}
      </button>
      {resultado && (
        <p className="mt-2 text-xs text-slate-500">
          {resultado.processadas === 0
            ? "Nenhuma nota pendente de reprocessamento."
            : `${resultado.processadas} nota(s) revisada(s): ${resultado.atualizadas} atualizada(s), ${resultado.semDadoNoXml} sem grupo ICMS61 no XML, ${resultado.erros} com erro. ${
                resultado.processadas >= 200 ? "Pode haver mais — clique de novo pra continuar." : ""
              }`}
        </p>
      )}
    </div>
  );
}
