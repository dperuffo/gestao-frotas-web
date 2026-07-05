"use client";

import { useState, useTransition, type FormEvent } from "react";
import { enviarContrapropostaAcao, decidirNegociacaoAcao } from "../actions";
import { PRODUTOS_POSTO } from "@/lib/constants";
import type { AutorNegociacao, DadosRodada } from "@/lib/negociacoesPostos";

// Fase 27.50 — ações disponíveis quando é a vez do usuário logado responder
// (status "pendente_cliente" ou "pendente_posto" batendo com o lado dele):
// aceitar, recusar, ou abrir uma nova rodada com uma contraproposta. Os
// valores da última rodada vêm pré-preenchidos pra facilitar (o comum é
// mudar só o preço, por exemplo).
export function FormularioContraproposta({
  negociacaoId,
  autor,
  ultimaRodada,
}: {
  negociacaoId: string;
  autor: AutorNegociacao;
  ultimaRodada: DadosRodada;
}) {
  const [mostrarContraproposta, setMostrarContraproposta] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function decidir(decisao: "aceita" | "recusada") {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await decidirNegociacaoAcao(negociacaoId, autor, decisao);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function handleSubmitContraproposta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await enviarContrapropostaAcao(negociacaoId, autor, undefined as never, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      setMostrarContraproposta(false);
    });
  }

  return (
    <div className="card space-y-4 p-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <p className="text-sm font-medium text-slate-700">É a sua vez de responder esta negociação.</p>

      {!mostrarContraproposta && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={isPending} onClick={() => decidir("aceita")} className="btn-primary">
            Aceitar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setMostrarContraproposta(true)}
            className="btn-secondary"
          >
            Contrapropor
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => decidir("recusada")}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Recusar
          </button>
        </div>
      )}

      {mostrarContraproposta && (
        <form onSubmit={handleSubmitContraproposta} className="space-y-4 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Combustível</label>
              <select name="combustivel" required className="input" defaultValue={ultimaRodada.combustivel}>
                {PRODUTOS_POSTO.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Volume mínimo mensal (L)</label>
              <input
                type="number"
                name="volume_minimo_mensal"
                required
                min="1"
                step="1"
                defaultValue={ultimaRodada.volume_minimo_mensal}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Preço por litro (R$)</label>
              <input
                type="number"
                name="preco_unitario"
                required
                min="0.01"
                step="0.01"
                defaultValue={ultimaRodada.preco_unitario}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Vigência — início</label>
              <input
                type="date"
                name="vigencia_inicio"
                required
                defaultValue={ultimaRodada.vigencia_inicio}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Vigência — fim</label>
              <input
                type="date"
                name="vigencia_fim"
                required
                defaultValue={ultimaRodada.vigencia_fim}
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? "Enviando..." : "Enviar contraproposta"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMostrarContraproposta(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
