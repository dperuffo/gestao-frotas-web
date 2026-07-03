"use client";

import { useRef, useState, useTransition } from "react";
import { importarCentrosCusto, type ResultadoImportacao } from "../actions";

export function ImportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resposta = await importarCentrosCusto(undefined, formData);
      setResultado(resposta);
    });
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Arquivo Excel (.xlsx)</label>
          <input type="file" name="arquivo" accept=".xlsx" required className="input" />
          <p className="mt-1 text-xs text-slate-500">
            Baixe o modelo acima, preencha uma linha por centro de custo e envie o arquivo aqui.
          </p>
        </div>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Importando..." : "Importar centros de custo"}
        </button>
      </form>

      {resultado && "erro" in resultado && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{resultado.erro}</div>
      )}

      {resultado && "linhas" in resultado && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap gap-4 border-b border-slate-100 p-4 text-sm">
            <span>
              Total processado: <strong>{resultado.total}</strong>
            </span>
            <span className="text-status-ativo">
              Sucesso: <strong>{resultado.sucesso}</strong>
            </span>
            <span className="text-red-600">
              Erros: <strong>{resultado.erros}</strong>
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Linha</th>
                <th className="px-4 py-3">Centro de custo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultado.linhas.map((l) => (
                <tr key={l.linha}>
                  <td className="px-4 py-3">{l.linha}</td>
                  <td className="px-4 py-3">{l.identificacao}</td>
                  <td className="px-4 py-3">
                    <span className={l.status === "ok" ? "badge-ativo" : "badge-inativo"}>
                      {l.status === "ok" ? "OK" : "Erro"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.mensagem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
