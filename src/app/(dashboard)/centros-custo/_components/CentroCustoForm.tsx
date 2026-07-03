"use client";

import { useState, useTransition, type FormEvent } from "react";
import { atualizarCentroCusto } from "../actions";
import type { Database } from "@/types/database.types";

type CentroCusto = Database["public"]["Tables"]["centros_custo"]["Row"];

export function CentroCustoForm({ centroCusto }: { centroCusto: CentroCusto }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await atualizarCentroCusto(centroCusto.id, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Nome <span className="text-red-500">*</span>
          </label>
          <input name="nome" required defaultValue={centroCusto.nome} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Código</label>
          <input name="codigo" defaultValue={centroCusto.codigo ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Responsável</label>
          <input name="responsavel" defaultValue={centroCusto.responsavel ?? ""} className="input" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
        <textarea name="descricao" defaultValue={centroCusto.descricao ?? ""} className="input" rows={3} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={centroCusto.ativo ?? true}
          className="h-4 w-4 rounded border-slate-300"
        />
        Centro de custo ativo
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
