"use client";

import { useState, useTransition } from "react";
import { atualizarCicloPagamentoAcao } from "@/app/(dashboard)/negociacoes/actions";

// Fase 27.80 — pedido do Daniel: o prazo de abastecimento+pagamento (ciclo
// de faturamento + prazo de vencimento, ex: "7+7" = 7 dias de abastecimentos
// acumulados + 7 dias pro posto emitir/o cliente pagar a fatura) é
// parametrizável por relação cliente+posto, não por negociação — e pode ser
// alterado a qualquer momento, valendo a partir do PRÓXIMO ciclo (faturas já
// geradas guardam seu próprio período/vencimento, nunca são retroativamente
// alteradas). Só o admin (FNI) edita — verificação real fica no server
// action/lib (atualizarCicloPagamento), esta tela só decide se MOSTRA o
// formulário (prop podeEditarCiclo, true só em /clientes/[id], visão admin).
export function FormularioCicloPagamento({
  negociacaoId,
  cicloAtual,
  prazoAtual,
}: {
  negociacaoId: string;
  cicloAtual: number;
  prazoAtual: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [ok, setOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setOk(false);
        }}
        className="text-xs text-frota-600 hover:underline"
      >
        Ajustar ciclo/prazo ({cicloAtual}+{prazoAtual} dias)
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(undefined);
        setOk(false);
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const resultado = await atualizarCicloPagamentoAcao(negociacaoId, undefined as never, formData);
          if (resultado?.erro) {
            setErro(resultado.erro);
            return;
          }
          setOk(true);
          setAberto(false);
        });
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Ciclo (dias)</label>
        <input
          type="number"
          name="ciclo_faturamento_dias"
          required
          min="1"
          step="1"
          defaultValue={cicloAtual}
          className="input w-20 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Prazo (dias)</label>
        <input
          type="number"
          name="prazo_vencimento_dias"
          required
          min="1"
          step="1"
          defaultValue={prazoAtual}
          className="input w-20 text-sm"
        />
      </div>
      <button type="submit" disabled={isPending} className="btn-primary text-xs">
        {isPending ? "Salvando..." : "Salvar"}
      </button>
      <button type="button" className="btn-secondary text-xs" onClick={() => setAberto(false)}>
        Cancelar
      </button>
      {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
      {ok && <p className="w-full text-xs text-green-700">Ajustado — vale a partir do próximo ciclo.</p>}
    </form>
  );
}
