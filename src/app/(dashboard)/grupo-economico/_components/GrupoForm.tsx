"use client";

import { useState, useTransition, type FormEvent } from "react";
import { atualizarGrupo } from "../actions";
import type { Database } from "@/types/database.types";

type Grupo = Database["public"]["Tables"]["grupos_economicos"]["Row"];

export function GrupoForm({ grupo }: { grupo: Grupo }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await atualizarGrupo(grupo.id, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Nome do Grupo <span className="text-red-500">*</span>
        </label>
        <input name="nome" required defaultValue={grupo.nome} className="input" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ da Matriz</label>
        <input name="cnpj_matriz" defaultValue={grupo.cnpj_matriz ?? ""} className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="ativo" defaultChecked={grupo.ativo} className="h-4 w-4 rounded border-slate-300" />
        Grupo ativo
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
