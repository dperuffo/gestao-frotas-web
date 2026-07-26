"use client";

import { useActionState } from "react";
import { criarRedePosto, type CriarRedeFormState } from "../actions";

// Fase Posto/Rede (26/07/2026) — formulário simples pra um posto (segmento
// Revenda) que ainda não está em nenhuma rede criar a sua Rede de Postos.
// Quem cria vira a empresa administradora (paga a assinatura única da
// rede) — ver criar_rede_posto_self_service / actions.ts.
export function CriarRedeForm({ empresaId }: { empresaId: string }) {
  const acao = criarRedePosto.bind(null, empresaId);
  const [state, formAction, pendente] = useActionState<CriarRedeFormState, FormData>(acao, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Nome da rede</label>
        <input name="nome" required className="input text-sm" placeholder="Ex.: Rede Postos Sul" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">CNPJ da matriz (opcional)</label>
        <input name="cnpj_matriz" className="input text-sm" placeholder="00.000.000/0000-00" />
      </div>
      <button type="submit" disabled={pendente} className="btn-secondary text-sm">
        {pendente ? "Criando..." : "Criar Rede de Postos"}
      </button>
      {state?.erro && <p className="w-full text-xs text-red-600">{state.erro}</p>}
    </form>
  );
}
