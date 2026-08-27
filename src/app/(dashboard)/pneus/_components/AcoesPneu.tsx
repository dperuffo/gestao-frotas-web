"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { registrarRecapagemAcao, removerPneuAcao, excluirPneuAcao } from "../actions";

export function AcoesPneu({ id, status }: { id: string; status: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | undefined>();

  function recapar() {
    setErro(undefined);
    const valorTexto = window.prompt("Valor pago nesta recapagem (R$):");
    if (valorTexto === null) return;
    const valor = Number(valorTexto.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      setErro("Valor inválido.");
      return;
    }
    iniciar(async () => {
      const resultado = await registrarRecapagemAcao(id, valor);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function remover(status: "Removido" | "Descartado") {
    setErro(undefined);
    const motivo = window.prompt(`Motivo (${status.toLowerCase()}):`) ?? "";
    const hodometroTexto = window.prompt("Hodômetro do veículo na remoção (km, opcional):");
    const hodometro = hodometroTexto ? Number(hodometroTexto.replace(",", ".")) : null;
    iniciar(async () => {
      const resultado = await removerPneuAcao(id, status, new Date().toISOString().slice(0, 10), hodometro, motivo);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function excluir() {
    if (!confirm("Excluir este registro de pneu? Essa ação não pode ser desfeita.")) return;
    iniciar(() => {
      excluirPneuAcao(id);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/pneus/${id}/editar`} className="text-xs font-medium text-frota-600 hover:underline">
          Editar
        </Link>
        {status === "Em uso" && (
          <>
            <button type="button" disabled={pendente} onClick={recapar} className="text-xs font-medium text-frota-600 hover:underline">
              Recapar
            </button>
            <button type="button" disabled={pendente} onClick={() => remover("Removido")} className="text-xs font-medium text-slate-500 hover:underline">
              Remover
            </button>
            <button type="button" disabled={pendente} onClick={() => remover("Descartado")} className="text-xs font-medium text-red-600 hover:underline">
              Descartar
            </button>
          </>
        )}
        <button type="button" disabled={pendente} onClick={excluir} className="text-xs font-medium text-red-600 hover:underline">
          Excluir
        </button>
      </div>
      {erro && <p className="max-w-[220px] text-right text-xs text-red-600">{erro}</p>}
    </div>
  );
}
