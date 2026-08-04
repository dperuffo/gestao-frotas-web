"use client";

import { useState, useTransition, type FormEvent } from "react";
import { registrarRespostaOrcamentoAcao, decidirOrcamentoAcao } from "../actions";
import { STATUS_ORCAMENTO_LABEL, STATUS_ORCAMENTO_COR } from "@/lib/oficinas";

// Fase marketplace-pecas (04/08/2026) — o antigo SolicitarOrcamentoButton
// (1 form por card de oficina) foi substituído pela seleção multi-card em
// CatalogoOficinasComSelecao.tsx, que já cobre o fluxo de pedir cotação.

// Um PEDIDO agora pode ter várias PROPOSTAS (1 por oficina escolhida) —
// este card mostra todas lado a lado pra comparação, cada uma com seu
// próprio formulário de resposta/decisão (RespostaOrcamentoForm/
// DecisaoOrcamentoBotoes abaixo, que já operavam por proposta e não
// mudaram de comportamento).
type PropostaComparacao = {
  id: string;
  status: string;
  valor_orcado: number | null;
  prazo_execucao: string | null;
  observacoes_oficina: string | null;
  oficinas_credenciadas: { nome: string } | null;
};

export function PedidoOrcamentoCard({
  placa,
  descricaoServico,
  criadoEm,
  statusPedido,
  propostas,
}: {
  placa: string | null;
  descricaoServico: string;
  criadoEm: string;
  statusPedido: string;
  propostas: PropostaComparacao[];
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">
            {descricaoServico} {placa ? `· ${placa}` : ""}
          </p>
          <p className="text-xs text-slate-400">
            {new Date(criadoEm).toLocaleDateString("pt-BR")} · {propostas.length} oficina{propostas.length > 1 ? "s" : ""} cotada
            {propostas.length > 1 ? "s" : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            statusPedido === "decidido" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {statusPedido === "decidido" ? "Decidido" : "Aguardando propostas"}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {propostas.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">{p.oficinas_credenciadas?.nome ?? "Oficina"}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_ORCAMENTO_COR[p.status] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {STATUS_ORCAMENTO_LABEL[p.status] ?? p.status}
              </span>
            </div>
            {p.valor_orcado != null && (
              <p className="mt-1 text-sm text-slate-700">
                <strong>{p.valor_orcado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                {p.prazo_execucao ? ` · Prazo: ${p.prazo_execucao}` : ""}
              </p>
            )}
            {p.observacoes_oficina && <p className="mt-1 text-xs text-slate-500">{p.observacoes_oficina}</p>}
            <div className="mt-2 flex items-center gap-3">
              {p.status === "solicitado" && <RespostaOrcamentoForm id={p.id} />}
              {p.status === "respondido" && <DecisaoOrcamentoBotoes id={p.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>
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
