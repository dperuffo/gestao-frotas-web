"use client";

import { useState, useTransition } from "react";
import { atualizarCicloPagamentoAcao } from "@/app/(dashboard)/negociacoes/actions";

// Fase 27.80 — pedido do Daniel: o ciclo de faturamento é parametrizável,
// não faz parte do fluxo de negociação — e pode ser alterado a qualquer
// momento, valendo a partir do PRÓXIMO ciclo (faturas já geradas guardam
// seu próprio período/vencimento, nunca são retroativamente alteradas). Só
// o admin (FNI) edita — verificação real fica no server action/lib
// (atualizarCicloPagamento), esta tela só decide se MOSTRA o formulário
// (prop podeEditarCiclo, true só em /clientes/[id], visão admin).
//
// Fase 27.108 — Daniel corrigiu: "o ciclo é definido para o cliente e nao
// para a negociacao entre cliente e posto" — prop virou `empresaClienteId`
// (1 valor por cliente, vale pra qualquer posto/rede), não mais
// `negociacaoId`. Reflexo direto: CicloAbastecimentoPagamento.tsx agora
// renderiza este form UMA vez por cliente, não uma vez por posto.
//
// Fase CICLOS-6 — pedido do Daniel: ciclos fixos ancorados no calendário
// (dia 1 do mês em diante), com vencimento = próprio ciclo (ex.: ciclo de 7
// dias vence 7 dias depois de fechar). O campo "Prazo" separado sumiu — só
// um número agora, o ritmo do cliente (ex.: 7 = 4 janelas/mês, 15 = 2
// janelas/mês).
export function FormularioCicloPagamento({
  empresaClienteId,
  cicloAtual,
}: {
  empresaClienteId: string;
  cicloAtual: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [ok, setOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!aberto) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">
          Ciclo atual: <strong className="text-slate-900">{cicloAtual} dias</strong> (vencimento também em{" "}
          {cicloAtual} dias após o fechamento)
        </span>
        <button
          type="button"
          onClick={() => {
            setAberto(true);
            setOk(false);
          }}
          className="btn-secondary text-xs"
        >
          Editar
        </button>
        {ok && <span className="text-xs text-green-700">Ajustado — vale a partir do próximo ciclo.</span>}
      </div>
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
          const resultado = await atualizarCicloPagamentoAcao(empresaClienteId, undefined as never, formData);
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
      <button type="submit" disabled={isPending} className="btn-primary text-xs">
        {isPending ? "Salvando..." : "Salvar"}
      </button>
      <button type="button" className="btn-secondary text-xs" onClick={() => setAberto(false)}>
        Cancelar
      </button>
      {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
    </form>
  );
}
