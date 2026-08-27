"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprovarRejeitarAbastecimentoManualAcao } from "../../actions-pendentes-manual";

// Fase OCR-Abastecimento-Externo (27/08/2026) — mesmo espírito de
// aprovar/rejeitar já usado em Aprovações (manutenção) e no fluxo de
// ajustes de abastecimento: aprovar é 1 clique; rejeitar abre um campo de
// motivo obrigatório (fica registrado em rejeitado_motivo, visível pro
// motorista saber o que corrigir da próxima vez).
export function AcaoAprovacaoManual({ id }: { id: number }) {
  const router = useRouter();
  const [mostrarMotivo, setMostrarMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function aprovar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await aprovarRejeitarAbastecimentoManualAcao(id, true);
      if (resultado?.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  function rejeitar() {
    if (!motivo.trim()) {
      setErro("Informe o motivo da rejeição.");
      return;
    }
    setErro(undefined);
    startTransition(async () => {
      const resultado = await aprovarRejeitarAbastecimentoManualAcao(id, false, motivo.trim());
      if (resultado?.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {erro && <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{erro}</div>}

      {!mostrarMotivo ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={aprovar}
            className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? "Aprovando..." : "Aprovar"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setMostrarMotivo(true)}
            className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Rejeitar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da rejeição (ex.: foto ilegível, valor não confere)..."
            className="input w-full text-xs"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={rejeitar}
              className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "Rejeitando..." : "Confirmar rejeição"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setMostrarMotivo(false);
                setMotivo("");
                setErro(undefined);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
