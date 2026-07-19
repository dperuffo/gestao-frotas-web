"use client";

import { useState, useTransition } from "react";
import { marcarPagamentoAcao } from "../actions";

export type PagamentoFrete = {
  id: string;
  tipo: "adiantamento" | "saldo_final";
  percentual: number;
  valor: number;
  status: "pendente" | "pago";
  pago_em: string | null;
};

const LABEL_TIPO: Record<PagamentoFrete["tipo"], string> = {
  adiantamento: "Adiantamento (entrada)",
  saldo_final: "Saldo final (na conclusão)",
};

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Fase Fretes-Adiantamento-Combustível (19/07) — pedido do Daniel: cliente
// paga o frete em 2 parcelas (normalmente 30% de entrada, 70% na
// conclusão). As parcelas já vêm geradas pelo banco assim que o frete é
// aceito (trg_gerar_pagamentos_frete); aqui só mostra e confirma o
// pagamento de cada uma. O saldo final só libera o botão depois que o
// frete está concluído — a regra real está no banco (marcar_pagamento_frete),
// isso aqui é só pra não deixar o usuário clicar achando que vai funcionar.
export function PagamentosFrete({
  freteId,
  freteConcluido,
  pagamentos,
}: {
  freteId: string;
  freteConcluido: boolean;
  pagamentos: PagamentoFrete[];
}) {
  if (pagamentos.length === 0) return null;

  return (
    <div className="card mb-6 p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">💰 Pagamento do frete</h2>
      <p className="mb-4 text-xs text-slate-500">
        Confirme aqui quando cada parcela for paga ao motorista — isso não movimenta dinheiro automaticamente, é só
        pra manter o controle.
      </p>
      <div className="space-y-3">
        {pagamentos.map((p) => (
          <LinhaPagamento key={p.id} freteId={freteId} pagamento={p} bloqueado={p.tipo === "saldo_final" && !freteConcluido} />
        ))}
      </div>
    </div>
  );
}

function LinhaPagamento({
  freteId,
  pagamento,
  bloqueado,
}: {
  freteId: string;
  pagamento: PagamentoFrete;
  bloqueado: boolean;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleConfirmar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await marcarPagamentoAcao(freteId, pagamento.tipo);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {LABEL_TIPO[pagamento.tipo]} — {pagamento.percentual}%
        </p>
        <p className="text-xs text-slate-500">
          {formatoMoeda.format(pagamento.valor)}
          {pagamento.status === "pago" && pagamento.pago_em && ` — pago em ${new Date(pagamento.pago_em).toLocaleDateString("pt-BR")}`}
        </p>
        {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      </div>
      {pagamento.status === "pago" ? (
        <span className="text-xs font-semibold text-frota-600">✓ Pago</span>
      ) : (
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={isPending || bloqueado}
          title={bloqueado ? "Só é possível pagar o saldo final depois que o frete for concluído." : undefined}
          className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "..." : bloqueado ? "Aguarda conclusão" : "Confirmar pagamento"}
        </button>
      )}
    </div>
  );
}
