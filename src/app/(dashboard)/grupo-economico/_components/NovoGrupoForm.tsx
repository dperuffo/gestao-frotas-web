"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarGrupo } from "../actions";

type EmpresaOpcao = { id: string; nome: string };

// Fase Grupo-Economico-Frota-Billing (09/08/2026) — espelha
// rede-postos/_components/NovaRedeForm.tsx (Fase 27.139): agora também
// pede a empresa fundadora do grupo — obrigatório, ver criarGrupo em
// ../actions.ts (criarGrupoFrotaSelfService).
export function NovoGrupoForm({ empresasOpcoes }: { empresasOpcoes: EmpresaOpcao[] }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarGrupo(undefined, formData);
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
              Empresa fundadora <span className="text-red-500">*</span>
            </label>
            <select name="empresa_id" required defaultValue="" className="input">
              <option value="" disabled>
                Selecione a empresa...
              </option>
              {empresasOpcoes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Ela vira a empresa administradora do grupo — quem paga a assinatura única, se o grupo
              vier a ter uma. Você poderá vincular outras empresas ao grupo depois de criá-lo.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nome do Grupo <span className="text-red-500">*</span>
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
          {isPending ? "Salvando..." : "Salvar Grupo"}
        </button>
      </div>
    </form>
  );
}
