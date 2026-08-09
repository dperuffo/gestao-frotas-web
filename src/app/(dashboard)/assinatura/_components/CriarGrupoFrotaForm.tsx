"use client";

import { useActionState } from "react";
import { criarGrupoFrota, type CriarRedeFormState } from "../actions";

// Fase Grupo-Economico-Frota-Billing (09/08/2026) — espelha CriarRedeForm.tsx
// (Fase Posto/Rede): formulário simples pra uma empresa cliente que ainda
// não está em nenhum Grupo Econômico criar o seu. Quem cria vira a empresa
// administradora (paga a assinatura única do grupo, se vier a assinar um
// plano de grupo) — ver criar_grupo_frota_self_service / actions.ts.
export function CriarGrupoFrotaForm({ empresaId }: { empresaId: string }) {
  const acao = criarGrupoFrota.bind(null, empresaId);
  const [state, formAction, pendente] = useActionState<CriarRedeFormState, FormData>(acao, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Nome do grupo</label>
        <input name="nome" required className="input text-sm" placeholder="Ex.: Grupo Transportes Sul" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">CNPJ da matriz (opcional)</label>
        <input name="cnpj_matriz" className="input text-sm" placeholder="00.000.000/0000-00" />
      </div>
      <button type="submit" disabled={pendente} className="btn-secondary text-sm">
        {pendente ? "Criando..." : "Criar Grupo Econômico"}
      </button>
      {state?.erro && <p className="w-full text-xs text-red-600">{state.erro}</p>}
    </form>
  );
}
