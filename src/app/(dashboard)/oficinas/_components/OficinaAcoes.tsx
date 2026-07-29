"use client";

import { useState, useTransition, type FormEvent } from "react";
import { solicitarOrcamentoAcao, registrarRespostaOrcamentoAcao, decidirOrcamentoAcao } from "../actions";

export function SolicitarOrcamentoButton({
  empresaId,
  oficinaId,
  oficinaNome,
  placas,
}: {
  empresaId: string;
  oficinaId: string;
  oficinaNome: string;
  placas: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await solicitarOrcamentoAcao(empresaId, oficinaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else {
        setSucesso(true);
        (e.target as HTMLFormElement).reset();
        setTimeout(() => setAberto(false), 1200);
      }
    });
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn-secondary text-xs">
        Solicitar orçamento
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-600">Orçamento com {oficinaNome}</p>
      {erro && <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{erro}</div>}
      {sucesso && <div className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Solicitação registrada!</div>}
      <input list={`placas-${oficinaId}`} name="placa" placeholder="Placa (opcional)" className="input text-sm" />
      <datalist id={`placas-${oficinaId}`}>
        {placas.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <textarea name="descricao_servico" required rows={2} placeholder="Descreva o serviço desejado..." className="input text-sm" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn-primary text-xs">
          {isPending ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </form>
  );
}

export function RespostaOrcamentoForm({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await registrarRespostaOrcamentoAcao(id, formData);
      setAberto(false);
    });
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs font-medium text-frota-600 hover:underline">
        Registrar retorno da oficina
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <input type="number" name="valor_orcado" step="0.01" min={0} placeholder="Valor orçado (R$)" className="input text-sm" />
        <input name="prazo_execucao" placeholder="Prazo (ex.: 2 dias úteis)" className="input text-sm" />
      </div>
      <textarea name="observacoes_oficina" rows={2} placeholder="Observações da oficina..." className="input text-sm" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn-primary text-xs">
          {isPending ? "Salvando..." : "Salvar retorno"}
        </button>
      </div>
    </form>
  );
}

export function DecisaoOrcamentoBotoes({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function decidir(decisao: "aceito" | "recusado") {
    startTransition(async () => {
      await decidirOrcamentoAcao(id, decisao);
    });
  }

  return (
    <div className="flex gap-2">
      <button type="button" disabled={isPending} onClick={() => decidir("aceito")} className="btn-primary text-xs">
        Aceitar
      </button>
      <button type="button" disabled={isPending} onClick={() => decidir("recusado")} className="text-xs text-red-600 hover:underline">
        Recusar
      </button>
    </div>
  );
}
