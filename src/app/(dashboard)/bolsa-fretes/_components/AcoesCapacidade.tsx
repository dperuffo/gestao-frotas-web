"use client";

import { useTransition } from "react";
import { atualizarStatusCapacidadeAcao, excluirCapacidadeOciosaAcao } from "../actions";

export function AcoesCapacidade({ id, status }: { id: string; status: string }) {
  const [pendente, iniciar] = useTransition();

  function marcar(novoStatus: "utilizada" | "cancelada" | "ativo") {
    iniciar(() => {
      atualizarStatusCapacidadeAcao(id, novoStatus);
    });
  }

  function excluir() {
    if (!confirm("Excluir esta declaração de capacidade ociosa?")) return;
    iniciar(() => {
      excluirCapacidadeOciosaAcao(id);
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status === "ativo" && (
        <>
          <button type="button" disabled={pendente} onClick={() => marcar("utilizada")} className="text-xs font-medium text-frota-600 hover:underline">
            Marcar utilizada
          </button>
          <button type="button" disabled={pendente} onClick={() => marcar("cancelada")} className="text-xs font-medium text-slate-500 hover:underline">
            Cancelar
          </button>
        </>
      )}
      {status !== "ativo" && (
        <button type="button" disabled={pendente} onClick={() => marcar("ativo")} className="text-xs font-medium text-frota-600 hover:underline">
          Reativar
        </button>
      )}
      <button type="button" disabled={pendente} onClick={excluir} className="text-xs font-medium text-red-600 hover:underline">
        Excluir
      </button>
    </div>
  );
}
