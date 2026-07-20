"use client";

import { useState, useTransition } from "react";
import { aprovarEExecutarAcaoAcao, rejeitarAcaoSugeridaAcao } from "../actions";

export type AcaoSugerida = {
  id: number;
  tipo: string;
  alvo_tipo: string;
  alvo_label: string;
  titulo: string;
  descricao: string;
  severidade: string;
  status: string;
  decidido_em: string | null;
  decidido_por: string | null;
  erro_execucao: string | null;
  criado_em: string;
};

const SEVERIDADE_BADGE: Record<string, string> = {
  critica: "badge-inativo",
  alta: "badge-atencao",
  media: "badge-atencao",
  baixa: "badge-ativo",
};

const CONFIRMACAO_POR_TIPO: Record<string, string> = {
  cnh_vencida: "Bloquear este motorista agora? O status dele vai para Inativo até você reverter manualmente.",
  posto_acima_media: "Remover este posto da rede negociada agora? Ele deixa de contar como posto ativo da empresa.",
  hodometro_fora_padrao: "Cadastrar esse limite de variação de hodômetro para a placa agora?",
};

export function CardAcaoSugerida({ acao }: { acao: AcaoSugerida }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleAprovar() {
    const pergunta = CONFIRMACAO_POR_TIPO[acao.tipo] ?? "Executar esta ação agora?";
    if (!window.confirm(pergunta)) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await aprovarEExecutarAcaoAcao(acao.id, acao.tipo);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  function handleRejeitar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await rejeitarAcaoSugeridaAcao(acao.id);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  const pendente = acao.status === "pendente";

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={SEVERIDADE_BADGE[acao.severidade] ?? "badge-atencao"}>{acao.severidade}</span>
            <span className="text-xs uppercase tracking-wide text-slate-400">{acao.alvo_tipo}</span>
            <span className="text-sm font-semibold text-slate-900">{acao.alvo_label}</span>
          </div>
          <p className="text-sm font-medium text-slate-800">{acao.titulo}</p>
          <p className="mt-1 text-sm text-slate-600">{acao.descricao}</p>

          {!pendente && (
            <p className="mt-2 text-xs text-slate-400">
              {acao.status === "executada" && `Executada${acao.decidido_por ? ` por ${acao.decidido_por}` : ""}${acao.decidido_em ? ` em ${new Date(acao.decidido_em).toLocaleString("pt-BR")}` : ""}.`}
              {acao.status === "rejeitada" && `Rejeitada${acao.decidido_por ? ` por ${acao.decidido_por}` : ""}${acao.decidido_em ? ` em ${new Date(acao.decidido_em).toLocaleString("pt-BR")}` : ""}.`}
              {acao.status === "falhou" && `Falhou ao executar: ${acao.erro_execucao ?? "erro desconhecido"}.`}
            </p>
          )}
          {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
        </div>

        {pendente && (
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={handleRejeitar} disabled={isPending} className="btn-secondary text-xs">
              Rejeitar
            </button>
            <button type="button" onClick={handleAprovar} disabled={isPending} className="btn-primary text-xs">
              {isPending ? "Executando..." : "Aprovar e executar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
