"use client";

import { useActionState, useEffect, useRef } from "react";
import { criarSolicitacaoAprovacaoAcao, type CriarSolicitacaoState } from "../actions";

const CATEGORIAS = [
  { valor: "manutencao", label: "Manutenção" },
  { valor: "frete", label: "Negociação de frete" },
  { valor: "peca", label: "Compra de peça" },
  { valor: "outro", label: "Outro" },
];

export function NovaSolicitacaoForm({ empresaId }: { empresaId: string }) {
  const [estado, formAction, isPending] = useActionState<CriarSolicitacaoState, FormData>(
    criarSolicitacaoAprovacaoAcao,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Limpa o formulário depois de criar com sucesso — sem isso, o valor e o
  // título digitados ficavam presos na tela mesmo depois de a solicitação
  // já ter ido pro banco.
  useEffect(() => {
    if (estado?.ok) formRef.current?.reset();
  }, [estado?.ok]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-3 p-4">
      <input type="hidden" name="empresa_id" value={empresaId} />
      <h2 className="text-sm font-semibold text-slate-900">Nova solicitação</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoria</label>
          <select name="categoria" defaultValue="manutencao" className="input text-sm">
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$)</label>
          <input name="valor" type="text" inputMode="decimal" required placeholder="0,00" className="input text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Título</label>
          <input name="titulo" type="text" required placeholder="ex.: Troca de pneus do caminhão XYZ-1234" className="input text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">Descrição (opcional)</label>
          <textarea name="descricao" rows={2} className="input text-sm" />
        </div>
      </div>
      {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      {estado?.ok && <p className="text-sm text-status-ativo">Solicitação criada.</p>}
      <button type="submit" disabled={isPending} className="btn-primary text-sm">
        {isPending ? "Enviando..." : "Solicitar aprovação"}
      </button>
    </form>
  );
}
