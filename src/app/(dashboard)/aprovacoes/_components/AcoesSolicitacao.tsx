"use client";

import { useState, useTransition } from "react";
import { cancelarSolicitacaoAcao, decidirSolicitacaoAcao, marcarExecutadaAcao } from "../actions";

// Fase Gestao-Controles (27/08/2026) — botões de decisão por linha. A
// permissão de verdade (quem pode decidir o nível 2, por exemplo) é
// verificada no servidor (RPC decidir_solicitacao_aprovacao) — este
// componente só mostra o botão pra quem já enxerga a linha (RLS) e exibe
// a mensagem de erro que a RPC devolver, sem tentar adivinhar aqui quem
// tem ou não permissão.
export function AcoesSolicitacao({ id, status }: { id: string; status: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | undefined>();

  function decidir(decisao: "aprovado" | "reprovado") {
    setErro(undefined);
    const comentario =
      decisao === "reprovado" ? window.prompt("Motivo da reprovação (opcional):") ?? undefined : undefined;
    iniciar(async () => {
      const resultado = await decidirSolicitacaoAcao(id, decisao, comentario);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function executar() {
    setErro(undefined);
    iniciar(async () => {
      const resultado = await marcarExecutadaAcao(id);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  // Pedido do Daniel (27/08/2026, mid-turn): tirar da fila uma solicitação
  // que não vai ser executada, sem perder o histórico (vira "cancelada",
  // não é deletada). Só aparece pra pendente/aprovada — depois de
  // executada/reprovada não faz sentido mais.
  function cancelar() {
    if (!confirm("Cancelar esta solicitação? Ela sai da fila de pendências, mas continua no histórico.")) return;
    setErro(undefined);
    iniciar(async () => {
      const resultado = await cancelarSolicitacaoAcao(id);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status === "pendente" && (
          <>
            <button
              type="button"
              disabled={pendente}
              onClick={() => decidir("aprovado")}
              className="btn-secondary text-xs"
            >
              Aprovar
            </button>
            <button
              type="button"
              disabled={pendente}
              onClick={() => decidir("reprovado")}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Reprovar
            </button>
          </>
        )}
        {status === "aprovada" && (
          <button type="button" disabled={pendente} onClick={executar} className="btn-secondary text-xs">
            Marcar como executada
          </button>
        )}
        {(status === "pendente" || status === "aprovada") && (
          <button
            type="button"
            disabled={pendente}
            onClick={cancelar}
            className="text-xs font-medium text-slate-500 hover:underline"
          >
            Cancelar
          </button>
        )}
      </div>
      {erro && <p className="max-w-[220px] text-right text-xs text-red-600">{erro}</p>}
    </div>
  );
}
