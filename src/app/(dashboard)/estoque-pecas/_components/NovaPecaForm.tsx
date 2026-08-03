"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarPecaAcao } from "../actions";

export function NovaPecaForm({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarPecaAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else router.push(`/estoque-pecas?empresa=${empresaId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Nome da peça <span className="text-red-500">*</span>
          </label>
          <input name="nome" required className="input" placeholder="Filtro de óleo, pastilha de freio..." />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Código / SKU</label>
          <input name="codigo" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Unidade de medida</label>
          <select name="unidade_medida" className="input" defaultValue="un">
            <option value="un">Unidade (un)</option>
            <option value="l">Litro (l)</option>
            <option value="kg">Quilo (kg)</option>
            <option value="par">Par</option>
            <option value="jogo">Jogo</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Estoque mínimo</label>
          <input type="number" name="quantidade_minima" min={0} step="0.01" defaultValue={0} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Estoque inicial (opcional)</label>
          <input type="number" name="quantidade_inicial" min={0} step="0.01" className="input" placeholder="0" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Custo unitário (estoque inicial)</label>
          <input type="number" name="custo_unitario" min={0} step="0.01" className="input" placeholder="R$" />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Cadastrar Peça"}
        </button>
      </div>
    </form>
  );
}
