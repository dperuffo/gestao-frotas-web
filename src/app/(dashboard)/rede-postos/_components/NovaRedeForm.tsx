"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarRede } from "../actions";

type PostoOpcao = { id: string; nome: string };

// Fase 27.139 — substitui o form antigo (só nome/CNPJ) por um que também
// pede o posto fundador da Rede — obrigatório agora, ver criarRede em
// ../actions.ts.
export function NovaRedeForm({ postosOpcoes }: { postosOpcoes: PostoOpcao[] }) {
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      <section className="card max-w-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Posto fundador <span className="text-red-500">*</span>
            </label>
            <select name="empresa_id" required defaultValue="" className="input">
              <option value="" disabled>
                Selecione o posto...
              </option>
              {postosOpcoes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Você poderá vincular outros postos a esta Rede depois de criá-la.
            </p>
          </div>
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
  );
}
