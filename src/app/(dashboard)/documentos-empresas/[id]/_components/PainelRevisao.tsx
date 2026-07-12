"use client";

import { useState, useTransition } from "react";
import { revisarDocumentacaoAcao } from "../../actions";
import type { StatusDocumentacao } from "@/lib/empresasDocumentos";

// Fase 27.149 — decisão do admin (aprovar/rejeitar) sobre a documentação
// inteira de uma empresa. Rejeitar exige motivo (checado de novo em
// revisarDocumentacao, src/lib/empresasDocumentos.ts — não confia só no
// required do textarea).
export function PainelRevisao({ empresaId, status }: { empresaId: string; status: StatusDocumentacao }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === "aprovada") {
    return (
      <div className="card p-6">
        <p className="text-sm text-green-700">Documentação já aprovada.</p>
      </div>
    );
  }

  function decidir(decisao: "aprovada" | "rejeitada") {
    setErro(null);
    startTransition(async () => {
      const resultado = await revisarDocumentacaoAcao(empresaId, decisao, motivo);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-slate-900">Decisão</h2>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">Motivo (obrigatório se rejeitar)</label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="input"
          placeholder="Ex: comprovante de endereço da empresa vencido, envie um mais recente."
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => decidir("aprovada")} disabled={isPending} className="btn-primary">
          Aprovar
        </button>
        <button
          type="button"
          onClick={() => decidir("rejeitada")}
          disabled={isPending}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Rejeitar
        </button>
      </div>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
