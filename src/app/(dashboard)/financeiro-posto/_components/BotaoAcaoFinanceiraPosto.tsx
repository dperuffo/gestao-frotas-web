"use client";

import { useState, useTransition } from "react";

// Fase 27.64 — botão genérico de "ação com confirmação" (marcar fatura/
// despesa como paga, cancelar, excluir) — mesmo espírito de
// BotaoCancelarNegociacao, generalizado pra não repetir o mesmo componente
// 4 vezes na tela financeira do posto.
export function BotaoAcaoFinanceiraPosto({
  id,
  acao,
  rotulo,
  variante = "primary",
}: {
  id: string;
  acao: (id: string) => Promise<{ erro?: string }>;
  rotulo: string;
  variante?: "primary" | "danger";
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className={
          variante === "danger"
            ? "text-xs text-red-600 hover:underline"
            : "text-xs font-medium text-frota-600 hover:underline"
        }
      >
        {rotulo}
      </button>
    );
  }

  function handleConfirmar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await acao(id);
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
        className={
          variante === "danger"
            ? "rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            : "rounded bg-frota-600 px-2 py-1 font-medium text-white hover:bg-frota-700 disabled:opacity-50"
        }
      >
        {isPending ? "..." : "Sim"}
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="text-slate-500 hover:underline">
        Voltar
      </button>
    </div>
  );
}
