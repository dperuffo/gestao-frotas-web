"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { importarPisosAntt, type ResultadoImportacaoPisosAntt } from "../actions";

export function ImportForm() {
  const [resultado, setResultado] = useState<ResultadoImportacaoPisosAntt | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resposta = await importarPisosAntt(undefined, formData);
      setResultado(resposta);
      if (!("erro" in resposta)) formRef.current?.reset();
    });
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} onSubmit={handleSubmit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Planilha modelo_piso_antt.xlsx</label>
          <input type="file" name="arquivo" accept=".xlsx" required className="input" />
          <p className="mt-1 text-xs text-slate-500">
            Upsert por tipo de carga + nº de eixos — reenviar a planilha inteira a cada atualização da ANTT é seguro.
          </p>
        </div>
        <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
          {isPending ? "Importando..." : "Importar piso ANTT"}
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
              Gravadas: <strong>{resultado.sucesso}</strong>
            </span>
            <span className="text-red-600">
              Erros: <strong>{resultado.erros}</strong>
            </span>
            {resultado.duplicadas > 0 && (
              <span className="text-amber-700">
                Repetidas na planilha (só a última valeu): <strong>{resultado.duplicadas}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
