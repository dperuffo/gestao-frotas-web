"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarApoliceAcao, atualizarApoliceAcao } from "../actions";
import type { Database } from "@/types/database.types";

type Apolice = Database["public"]["Tables"]["apolices_seguro"]["Row"];

export function ApoliceForm({ empresaId, apolice }: { empresaId: string; apolice?: Apolice }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = apolice
        ? await atualizarApoliceAcao(apolice.id, undefined, formData)
        : await criarApoliceAcao(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Seguradora <span className="text-red-500">*</span>
          </label>
          <input name="seguradora" required defaultValue={apolice?.seguradora ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Número da apólice <span className="text-red-500">*</span>
          </label>
          <input name="numero_apolice" required defaultValue={apolice?.numero_apolice ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Placa <span className="text-xs font-normal text-slate-400">(vazio = cobre a frota)</span>
          </label>
          <input name="placa" defaultValue={apolice?.placa ?? ""} className="input" placeholder="ABC1D23" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Vigência — início <span className="text-red-500">*</span>
          </label>
          <input type="date" name="vigencia_inicio" required defaultValue={apolice?.vigencia_inicio ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Vigência — fim <span className="text-red-500">*</span>
          </label>
          <input type="date" name="vigencia_fim" required defaultValue={apolice?.vigencia_fim ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cobertura</label>
          <input
            name="cobertura"
            defaultValue={apolice?.cobertura ?? ""}
            className="input"
            placeholder="Compreensiva, RCF, Roubo/Furto..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Franquia (R$)</label>
          <input
            type="number"
            name="valor_franquia"
            min={0}
            step="0.01"
            defaultValue={apolice?.valor_franquia ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prêmio anual (R$)</label>
          <input
            type="number"
            name="valor_premio"
            min={0}
            step="0.01"
            defaultValue={apolice?.valor_premio ?? ""}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
        <textarea name="observacoes" rows={3} defaultValue={apolice?.observacoes ?? ""} className="input" />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : apolice ? "Salvar alterações" : "Cadastrar apólice"}
        </button>
      </div>
    </form>
  );
}
