"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarSinistroAcao } from "../actions";
import { TIPOS_SINISTRO, GRAVIDADES_SINISTRO } from "@/lib/checklist";

export function NovoSinistroForm({ empresaId, placas }: { empresaId: string; placas: string[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarSinistroAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else router.push(`/sinistros?empresa=${empresaId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Placa <span className="text-red-500">*</span>
          </label>
          <input list="placas-sinistro" name="placa" required className="input" placeholder="ABC1D23" />
          <datalist id="placas-sinistro">
            {placas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Data do sinistro <span className="text-red-500">*</span>
          </label>
          <input type="date" name="data_sinistro" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select name="tipo" required defaultValue="" className="input">
            <option value="" disabled>
              Selecione...
            </option>
            {TIPOS_SINISTRO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Gravidade</label>
          <select name="gravidade" className="input" defaultValue="">
            <option value="">Selecione...</option>
            {GRAVIDADES_SINISTRO.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Motorista</label>
          <input name="motorista_nome" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Local da ocorrência</label>
          <input name="local_ocorrencia" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Custo estimado (R$)</label>
          <input type="number" name="custo_estimado" min={0} step="0.01" className="input" />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" name="houve_vitima" id="houve_vitima" className="h-4 w-4 rounded border-slate-300" />
          <label htmlFor="houve_vitima" className="text-sm font-medium text-slate-700">
            Houve vítima
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
        <textarea name="descricao" rows={3} className="input" placeholder="Circunstâncias do sinistro..." />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Registrar Sinistro"}
        </button>
      </div>
    </form>
  );
}
