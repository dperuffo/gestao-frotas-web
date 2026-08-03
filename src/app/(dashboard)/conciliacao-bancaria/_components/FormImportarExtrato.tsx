"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { importarExtratoAcao } from "../actions";

export function FormImportarExtrato({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(undefined);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const resultado = await importarExtratoAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setSucesso(resultado?.sucesso);
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sucesso}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Arquivo (.ofx ou .csv)</label>
          <input type="file" name="arquivo" accept=".ofx,.csv,text/csv" required className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Conta bancária</label>
          <input name="conta_bancaria" placeholder="Ex.: Itaú CC 12345-6" className="input text-sm" />
        </div>
      </div>

      <p className="text-xs text-slate-400">
        CSV precisa ter colunas de Data, Descrição e Valor (valor negativo = saída). A maioria dos bancos
        exporta o extrato em OFX direto do internet banking — é o formato mais confiável.
      </p>

      <button type="submit" disabled={isPending} className="btn-primary text-sm">
        {isPending ? "Importando..." : "Importar Extrato"}
      </button>
    </form>
  );
}
