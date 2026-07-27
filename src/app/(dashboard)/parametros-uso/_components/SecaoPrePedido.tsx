"use client";

import { useTransition } from "react";
import { salvarParametroPrePedidoAcao } from "../actions";

// Pré-Pedido é diferente dos outros 10 tipos: não é uma lista de regras
// escopadas por placa/motorista, e sim um único interruptor por empresa —
// quando ligado, todo Plano de Viagem criado a partir de uma rota do
// Roteirizador Inteligente gera automaticamente um Pré-Pedido com os pontos
// de abastecimento pré-agendados, e o antifraude/verificar passa a só
// autorizar abastecimento nesses postos/placas.
export function SecaoPrePedido({ empresaId, habilitado }: { empresaId: string; habilitado: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const pergunta = habilitado
      ? "Desativar o Pré-Pedido? Novos Planos de Viagem deixarão de gerar Pré-Pedido, e o antifraude/verificar deixará de restringir abastecimentos por rota pré-agendada."
      : "Ativar o Pré-Pedido? A partir de agora, todo Plano de Viagem criado com rota calculada no Roteirizador Inteligente vai gerar automaticamente um Pré-Pedido, e abastecimentos passam a ser autorizados só nos postos/placas pré-agendados.";
    if (!window.confirm(pergunta)) return;
    startTransition(async () => {
      await salvarParametroPrePedidoAcao(empresaId, !habilitado);
    });
  }

  return (
    <div className="card p-4">
      <p className="text-sm text-slate-600">
        Quando habilitado, presume-se que uma rota inteligente foi traçada e um Plano de Viagem criado a partir dela.
        Esse Plano gera um <strong>Pré-Pedido</strong> — com número sequencial e os pontos de abastecimento
        pré-agendados — e o abastecimento passa a ser <strong>restringido</strong>: só é autorizado em um posto que
        conste como parada pré-agendada daquela placa.
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 p-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
            habilitado ? "bg-frota-600" : "bg-slate-300"
          }`}
          aria-pressed={habilitado}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              habilitado ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm font-medium text-slate-700">
          Pré-Pedido {habilitado ? "habilitado" : "desabilitado"} para este cliente
        </span>
      </div>
    </div>
  );
}
