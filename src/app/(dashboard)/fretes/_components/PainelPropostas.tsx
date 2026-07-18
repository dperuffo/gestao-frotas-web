"use client";

import { useState, useTransition } from "react";
import { aceitarPropostaAcao, recusarPropostaAcao, contraporPropostaAcao } from "../actions";
import { CartaoReputacaoMotorista, type ReputacaoMotorista } from "./CartaoReputacaoMotorista";

export type Proposta = {
  negociacao_id: string;
  motorista_id: string;
  nome_motorista: string;
  telefone_motorista: string | null;
  status: string;
  rodada_atual: number;
  ultimo_valor: number;
  ultimo_autor: string;
  criado_em: string;
} & ReputacaoMotorista;

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PainelPropostas({ empresaId, propostas, freteAberto }: { empresaId: string; propostas: Proposta[]; freteAberto: boolean }) {
  if (propostas.length === 0) {
    return <p className="text-sm text-slate-400">Nenhuma proposta recebida ainda.</p>;
  }

  return (
    <div className="space-y-3">
      {propostas.map((p) => (
        <LinhaProposta key={p.negociacao_id} empresaId={empresaId} proposta={p} freteAberto={freteAberto} />
      ))}
    </div>
  );
}

function LinhaProposta({ empresaId, proposta, freteAberto }: { empresaId: string; proposta: Proposta; freteAberto: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | undefined>();
  const [contrapropondo, setContrapropondo] = useState(false);
  const [valor, setValor] = useState("");

  const aberta = proposta.status === "aberta";
  const podeAgir = aberta && freteAberto && proposta.ultimo_autor === "motorista";

  function aceitar() {
    setErro(undefined);
    startTransition(async () => {
      const r = await aceitarPropostaAcao(proposta.negociacao_id, empresaId);
      if (r?.erro) setErro(r.erro);
    });
  }

  function recusar() {
    setErro(undefined);
    startTransition(async () => {
      const r = await recusarPropostaAcao(proposta.negociacao_id, empresaId);
      if (r?.erro) setErro(r.erro);
    });
  }

  function enviarContraproposta() {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero <= 0) {
      setErro("Informe um valor válido.");
      return;
    }
    setErro(undefined);
    startTransition(async () => {
      const r = await contraporPropostaAcao(proposta.negociacao_id, empresaId, numero, null);
      if (r?.erro) setErro(r.erro);
      else setContrapropondo(false);
    });
  }

  const LABEL_STATUS: Record<string, string> = {
    aberta: "Em negociação",
    aceita: "Aceita",
    recusada: "Recusada",
    retirada: "Motorista retirou",
    perdida: "Perdida (outro motorista foi escolhido)",
  };

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{proposta.nome_motorista}</p>
          <p className="text-xs text-slate-500">{proposta.telefone_motorista ?? "—"}</p>
          <CartaoReputacaoMotorista reputacao={proposta} />
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-900">{formatoMoeda.format(proposta.ultimo_valor)}</p>
          <p className="text-xs text-slate-500">
            Rodada {proposta.rodada_atual} · última de {proposta.ultimo_autor === "motorista" ? "motorista" : "você"}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs font-medium text-slate-500">{LABEL_STATUS[proposta.status] ?? proposta.status}</p>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

      {podeAgir && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={aceitar} disabled={isPending} className="btn-primary text-xs">
            Aceitar
          </button>
          <button type="button" onClick={() => setContrapropondo((v) => !v)} disabled={isPending} className="btn-secondary text-xs">
            Contrapropor
          </button>
          <button type="button" onClick={recusar} disabled={isPending} className="font-medium text-red-600 hover:underline text-xs">
            Recusar
          </button>
        </div>
      )}

      {contrapropondo && (
        <div className="mt-3 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Novo valor (R$)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="input text-sm"
            />
          </div>
          <button type="button" onClick={enviarContraproposta} disabled={isPending} className="btn-primary text-xs">
            {isPending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
