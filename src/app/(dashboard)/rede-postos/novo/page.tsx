"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarRede } from "../actions";

// Fase 27.87 — espelha /grupo-economico/novo/page.tsx.
export default function NovaRedePage() {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarRede(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Nova Rede de Postos</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
        <section className="card max-w-lg p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nome da Rede <span className="text-red-500">*</span>
              </label>
              <input name="nome" required className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ da Matriz (opcional)</label>
              <input name="cnpj_matriz" className="input" />
            </div>
          </div>
        </section>
        <div className="flex justify-end">
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? "Salvando..." : "Salvar Rede"}
          </button>
        </div>
      </form>
    </div>
  );
}
