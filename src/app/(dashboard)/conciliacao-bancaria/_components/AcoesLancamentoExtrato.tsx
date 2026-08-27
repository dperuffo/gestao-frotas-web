"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conciliarLancamentoAcao, ignorarLancamentoAcao, excluirLancamentoAcao } from "../actions";
import { formatarMoeda, formatarDataSemFuso, type SugestaoConciliacao, type ContaEmAberto } from "@/lib/conciliacaoBancaria";

// Fase Grupo 1 Rodopar item 3 (03/08/2026) — ações de conciliação por
// lançamento do extrato: confirma um dos até 3 candidatos sugeridos (por
// valor exato + data próxima), ou escolhe manualmente entre as demais
// contas em aberto do mesmo tipo, ou ignora (transferência entre contas
// próprias, saque, etc.).
//
// Fase Conciliacao-IA (27/08/2026) — cada sugestão agora mostra um selo de
// confiança (alta/média/baixa), calculado também a partir do nome do
// fornecedor batendo (ou não) na descrição do extrato — mesmo sinal que
// decide o que entra no lote de "Conciliar automaticamente" no topo da
// tela.
const COR_CONFIANCA: Record<string, string> = {
  alta: "bg-green-100 text-green-800",
  media: "bg-amber-100 text-amber-800",
  baixa: "bg-slate-200 text-slate-600",
};

const LABEL_CONFIANCA: Record<string, string> = {
  alta: "Alta confiança",
  media: "Média confiança",
  baixa: "Baixa confiança",
};
export function AcoesLancamentoExtrato({
  lancamentoId,
  tipo,
  valorLancamento,
  sugestoes,
  contasCandidatas,
}: {
  lancamentoId: string;
  tipo: "credito" | "debito";
  valorLancamento: number;
  sugestoes: SugestaoConciliacao[];
  contasCandidatas: ContaEmAberto[];
}) {
  const router = useRouter();
  const [contaManualId, setContaManualId] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const contaTipo = tipo === "debito" ? "contas_pagar" : "contas_receber";
  const idsSugeridos = new Set(sugestoes.map((s) => s.id));
  const outrasContas = contasCandidatas.filter((c) => !idsSugeridos.has(c.id));

  function confirmar(conta: ContaEmAberto) {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await conciliarLancamentoAcao(lancamentoId, contaTipo, conta.id, valorLancamento, conta.saldoEmAberto);
      if (resultado?.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  function ignorar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await ignorarLancamentoAcao(lancamentoId);
      if (resultado?.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  function excluir() {
    if (!confirm("Excluir este lançamento do extrato? Ele pode voltar a aparecer se reimportar o mesmo período.")) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await excluirLancamentoAcao(lancamentoId);
      if (resultado?.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {erro && <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{erro}</div>}

      {sugestoes.length > 0 ? (
        <div className="space-y-1">
          {sugestoes.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
              <div>
                <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${COR_CONFIANCA[s.confianca]}`}>
                  {LABEL_CONFIANCA[s.confianca]}
                </span>
                <span className="font-medium text-slate-700">{s.nome}</span>{" "}
                <span className="text-slate-400">
                  · venc. {formatarDataSemFuso(s.vencimento)} · {formatarMoeda(s.saldoEmAberto)}
                  {s.diferencaDias > 0 ? ` (±${s.diferencaDias}d)` : ""}
                </span>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => confirmar(s)}
                className="shrink-0 rounded bg-frota-600 px-2 py-1 font-medium text-white hover:bg-frota-700 disabled:opacity-50"
              >
                Vincular
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Nenhuma sugestão automática por valor/data.</p>
      )}

      {outrasContas.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={contaManualId} onChange={(e) => setContaManualId(e.target.value)} className="input flex-1 py-1 text-xs">
            <option value="">Vincular manualmente a...</option>
            {outrasContas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — venc. {formatarDataSemFuso(c.vencimento)} — {formatarMoeda(c.saldoEmAberto)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !contaManualId}
            onClick={() => {
              const conta = outrasContas.find((c) => c.id === contaManualId);
              if (conta) confirmar(conta);
            }}
            className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Vincular
          </button>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" disabled={isPending} onClick={ignorar} className="text-xs text-slate-500 hover:underline disabled:opacity-50">
          Ignorar
        </button>
        <button type="button" disabled={isPending} onClick={excluir} className="text-xs text-red-600 hover:underline disabled:opacity-50">
          Excluir
        </button>
      </div>
    </div>
  );
}
