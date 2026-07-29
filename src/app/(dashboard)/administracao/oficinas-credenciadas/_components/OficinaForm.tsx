"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarOficinaAcao, atualizarOficinaAcao } from "../actions";
import { ESPECIALIDADES_OFICINA } from "@/lib/oficinas";

type Oficina = {
  id: string;
  nome: string;
  cnpj: string | null;
  especialidades: string[];
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  municipio: string | null;
  uf: string | null;
  avaliacao_media: number | null;
};

export function OficinaForm({ oficina }: { oficina?: Oficina }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = oficina ? await atualizarOficinaAcao(oficina.id, undefined, formData) : await criarOficinaAcao(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else router.push("/administracao/oficinas-credenciadas");
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
          <input name="nome" required defaultValue={oficina?.nome} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">CNPJ</label>
          <input name="cnpj" defaultValue={oficina?.cnpj ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
          <input name="telefone" defaultValue={oficina?.telefone ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
          <input type="email" name="email" defaultValue={oficina?.email ?? ""} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700">Endereço</label>
          <input name="endereco" defaultValue={oficina?.endereco ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Município</label>
          <input name="municipio" defaultValue={oficina?.municipio ?? ""} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">UF</label>
          <input name="uf" maxLength={2} defaultValue={oficina?.uf ?? ""} className="input uppercase" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Avaliação média (0-5)</label>
          <input type="number" name="avaliacao_media" min={0} max={5} step="0.1" defaultValue={oficina?.avaliacao_media ?? ""} className="input" />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Especialidades</label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ESPECIALIDADES_OFICINA.map((esp) => (
            <label key={esp} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="especialidades"
                value={esp}
                defaultChecked={oficina?.especialidades?.includes(esp)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {esp}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : oficina ? "Salvar alterações" : "Cadastrar Oficina"}
        </button>
      </div>
    </form>
  );
}
