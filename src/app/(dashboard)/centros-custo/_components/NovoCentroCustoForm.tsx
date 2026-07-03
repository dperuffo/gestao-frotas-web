"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarCentroCusto } from "../actions";

export function NovoCentroCustoForm({ empresaId, nomeEmpresa }: { empresaId: string; nomeEmpresa: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarCentroCusto(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="max-w-lg rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <section className="card max-w-lg space-y-4 p-6">
        <input type="hidden" name="empresa_id" value={empresaId} />
        <p className="text-xs text-slate-500">
          Cliente: <span className="font-medium text-slate-700">{nomeEmpresa}</span>
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Nome <span className="text-red-500">*</span>
          </label>
          <input name="nome" required className="input" placeholder="Ex: Filial São Paulo" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Código</label>
          <input name="codigo" className="input" placeholder="Opcional" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Responsável</label>
          <input name="responsavel" className="input" placeholder="Opcional" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
          <textarea name="descricao" className="input" rows={3} placeholder="Opcional" />
        </div>
      </section>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar Centro de Custo"}
        </button>
      </div>
    </form>
  );
}
