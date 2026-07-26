"use client";

import { useState, useTransition } from "react";
import { darBaixaContaPagarAcao, cancelarContaPagarAcao } from "../actions";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Fase Financeiro-ERP (26/07/2026) — dar baixa (total ou parcial) numa
// conta a pagar. Diferente de BotaoAcaoFinanceiraPosto (confirmação
// simples "Sim/Voltar"), aqui precisa de um valor — abre um mini-form
// inline pré-preenchido com o saldo em aberto, editável pra baixa parcial.
export function BotaoBaixarContaPagar({ id, saldoEmAberto }: { id: string; saldoEmAberto: number }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(saldoEmAberto.toFixed(2));
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs font-medium text-frota-600 hover:underline">
        Dar baixa
      </button>
    );
  }

  function handleConfirmar() {
    setErro(undefined);
    const valorNumero = Number(valor);
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      setErro("Valor inválido.");
      return;
    }
    startTransition(async () => {
      const resultado = await darBaixaContaPagarAcao(id, valorNumero, null);
      if (resultado?.erro) setErro(resultado.erro);
      else setAberto(false);
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500">Saldo: {formatoMoeda.format(saldoEmAberto)}</span>
      <input
        type="number"
        step="0.01"
        min={0.01}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-24 rounded border border-slate-300 px-1.5 py-0.5 text-right"
      />
      {erro && <span className="text-red-600">{erro}</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={handleConfirmar}
        className="rounded bg-frota-600 px-2 py-1 font-medium text-white hover:bg-frota-700 disabled:opacity-50"
      >
        {isPending ? "..." : "Confirmar"}
      </button>
      <button type="button" onClick={() => setAberto(false)} className="text-slate-500 hover:underline">
        Voltar
      </button>
    </div>
  );
}

export function BotaoCancelarContaPagar({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="text-xs text-red-600 hover:underline">
        Cancelar
      </button>
    );
  }

  function handleConfirmar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await cancelarContaPagarAcao(id);
      if (resultado?.erro) setErro(resultado.erro);
      else setConfirmando(false);
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {erro ? <span className="text-red-600">{erro}</span> : <span className="text-slate-500">Confirma?</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={handleConfirmar}
        className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "..." : "Sim"}
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="text-slate-500 hover:underline">
        Voltar
      </button>
    </div>
  );
}
