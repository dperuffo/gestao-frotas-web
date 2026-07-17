"use client";

import { useActionState, useState, useTransition } from "react";
import { buscarMotoristaAcao, convidarParceiroAcao, type BuscaMotoristaState } from "../actions";

export function ConvidarParceiroForm({ empresaId }: { empresaId: string }) {
  const [estado, formAction, isPending] = useActionState<BuscaMotoristaState, FormData>(buscarMotoristaAcao, undefined);
  const [convidando, startConvite] = useTransition();
  const [convidado, setConvidado] = useState(false);
  const [erroConvite, setErroConvite] = useState<string | undefined>();

  function handleConvidar() {
    if (!estado?.encontrado) return;
    setErroConvite(undefined);
    startConvite(async () => {
      const resultado = await convidarParceiroAcao(empresaId, estado.encontrado!.motorista_id);
      if (resultado?.erro) setErroConvite(resultado.erro);
      else setConvidado(true);
    });
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Convidar motorista parceiro</h2>
      <p className="mb-4 text-xs text-slate-500">
        Busque pelo CPF ou telefone — o motorista precisa já ter conta no app &quot;Estrada que Cuida&quot;. Ele recebe o
        convite lá e decide se aceita entrar na sua rede.
      </p>

      <form action={formAction} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">CPF ou telefone</label>
          <input name="documento" type="text" required placeholder="000.000.000-00 ou (11) 99999-9999" className="input" />
        </div>
        <button type="submit" disabled={isPending} className="btn-secondary text-sm">
          {isPending ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {estado?.erro && <p className="mt-3 text-sm text-red-600">{estado.erro}</p>}

      {estado?.encontrado && !convidado && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{estado.encontrado.nome_completo}</p>
            <p className="text-xs text-slate-500">{estado.encontrado.telefone ?? "sem telefone cadastrado"}</p>
          </div>
          <button type="button" onClick={handleConvidar} disabled={convidando} className="btn-primary text-sm">
            {convidando ? "Convidando..." : "Convidar"}
          </button>
        </div>
      )}
      {erroConvite && <p className="mt-2 text-sm text-red-600">{erroConvite}</p>}
      {convidado && (
        <p className="mt-3 text-sm text-status-ativo">
          Convite enviado! Aparece como &quot;Convidado&quot; até o motorista responder.
        </p>
      )}
    </div>
  );
}
