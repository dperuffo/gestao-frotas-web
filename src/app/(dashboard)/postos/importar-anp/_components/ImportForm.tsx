"use client";

import { useState, useTransition } from "react";
import { importarPostosAnp, type ResultadoImportacaoAnp } from "../actions";

export function ImportForm() {
  const [resultado, setResultado] = useState<ResultadoImportacaoAnp | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resposta = await importarPostosAnp(undefined, formData);
      setResultado(resposta);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Arquivo postos_anp.xlsx
          </label>
          <input type="file" name="arquivo" accept=".xlsx" required className="input" />
          <p className="mt-1 text-xs text-slate-500">
            Planilha grande (~35 mil linhas) — a importação pode levar alguns instantes.
          </p>
        </div>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Importando (pode levar um tempo)..." : "Importar universo ANP"}
        </button>
      </form>

      {resultado && "erro" in resultado && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{resultado.erro}</div>
      )}

      {resultado && "sucesso" in resultado && (
        <div className="card p-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <span>
              Total processado: <strong>{resultado.total}</strong>
            </span>
            <span className="text-status-ativo">
              Gravados: <strong>{resultado.sucesso}</strong>
            </span>
            <span className="text-red-600">
              Erros (CNPJ inválido/ausente): <strong>{resultado.erros}</strong>
            </span>
            <span>
              Marcados como &quot;Gestão de Frotas&quot;: <strong>{resultado.ativosNaRede}</strong>
            </span>
            {resultado.duplicadas > 0 && (
              <span className="text-amber-700">
                CNPJ duplicado na planilha (só a última linha valeu): <strong>{resultado.duplicadas}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
