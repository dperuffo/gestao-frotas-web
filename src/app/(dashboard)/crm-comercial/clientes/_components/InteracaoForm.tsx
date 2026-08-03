"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarInteracaoAcao } from "../../actions";
import { TIPO_INTERACAO_LABEL } from "@/lib/crm";

export function InteracaoForm({ clienteId, empresaId }: { clienteId: string; empresaId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const resultado = await criarInteracaoAcao(clienteId, empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {erro && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
          <select name="tipo" required defaultValue="" className="input text-sm">
            <option value="" disabled>
              Selecione...
            </option>
            {Object.entries(TIPO_INTERACAO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Próxima ação (opcional)</label>
          <input name="proxima_acao_data" type="date" className="input text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">O que foi conversado/combinado</label>
        <textarea name="descricao" rows={2} required className="input text-sm" />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary text-sm disabled:opacity-50">
        {isPending ? "Registrando..." : "Registrar interação"}
      </button>
    </form>
  );
}
