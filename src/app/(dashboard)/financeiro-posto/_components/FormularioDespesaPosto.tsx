"use client";

import { useState, useTransition, type FormEvent } from "react";
import { lancarDespesaAcao } from "../actions";
import { TIPOS_DESPESA_POSTO, TIPO_DESPESA_POSTO_LABEL } from "@/lib/financeiroPostos";

export function FormularioDespesaPosto({ empresaPostoId }: { empresaPostoId: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = await lancarDespesaAcao(empresaPostoId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setSucesso(resultado?.sucesso);
        (document.getElementById("form-despesa-posto") as HTMLFormElement | null)?.reset();
      }
    });
  }

  return (
    <form id="form-despesa-posto" onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
          <select name="tipo" required className="input" defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {TIPOS_DESPESA_POSTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_DESPESA_POSTO_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$)</label>
          <input type="number" name="valor" step="0.01" min={0.01} required className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Competência</label>
          <input type="date" name="competencia" required className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Vencimento</label>
          <input type="date" name="vencimento" required className="input" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Descrição (opcional)</label>
        <input type="text" name="descricao" className="input" />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="recorrente" className="accent-frota-500" />
        Despesa recorrente (se repete todo mês)
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Salvando..." : "Lançar despesa"}
      </button>
    </form>
  );
}
