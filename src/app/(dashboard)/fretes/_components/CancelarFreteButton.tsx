"use client";

import { useTransition } from "react";
import { cancelarFrete } from "../actions";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Achado real (11/08/2026) — cancelar um frete que já teve parcela paga ao
// motorista não tinha nenhum aviso além do "Cancelar este frete?" genérico.
// Agora, se a Server Action devolver `precisaConfirmarPagamento` (ver
// cancelarFrete em actions.ts), mostramos um segundo aviso — mais forte,
// com o valor exato já pago — antes de confirmar de verdade. O valor NÃO é
// estornado automaticamente: fica registrado como perda em Contas a Pagar e
// associado ao motorista (ver reputação dele em Motoristas Parceiros).
export function CancelarFreteButton({ id, empresaId }: { id: string; empresaId: string }) {
  const [isPending, startTransition] = useTransition();

  function executar(confirmarComPagamento: boolean) {
    startTransition(async () => {
      const resultado = await cancelarFrete(id, empresaId, confirmarComPagamento);
      if (resultado.ok) return;

      if ("precisaConfirmarPagamento" in resultado) {
        const quantidade = resultado.qtdParcelasPagas === 1 ? "1 parcela" : `${resultado.qtdParcelasPagas} parcelas`;
        const confirmouComPagamento = confirm(
          `Atenção: ${formatoMoeda.format(resultado.totalPago)} já ${resultado.qtdParcelasPagas === 1 ? "foi pago" : "foram pagos"} ` +
            `ao motorista (${quantidade}).\n\n` +
            "Esse valor NÃO volta automaticamente — ele fica registrado como perda em Contas a Pagar " +
            "(seção Financeiro) e passa a contar no histórico do motorista.\n\n" +
            "Cancelar mesmo assim?"
        );
        if (confirmouComPagamento) executar(true);
        return;
      }

      alert(resultado.erro ?? "Não foi possível cancelar o frete.");
    });
  }

  function handleClick() {
    if (!confirm("Cancelar este frete?")) return;
    executar(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : "Cancelar"}
    </button>
  );
}
