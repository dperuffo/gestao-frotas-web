"use client";

import { useState, useTransition } from "react";
import { dispensarInsightAcao, marcarInsightLidoAcao, type InsightIA } from "../actions";
import { formatarMoeda } from "@/lib/financeiro";

const SEVERIDADE_BADGE: Record<string, string> = {
  critica: "badge-inativo",
  alta: "badge-atencao",
  media: "badge-atencao",
  baixa: "badge-ativo",
};

const CATEGORIA_LABEL: Record<string, string> = {
  combustivel_posto_caro: "Combustível",
  combustivel_consumo_baixo: "Combustível",
  manutencao_custo_subindo: "Manutenção",
  manutencao_componente_recorrente: "Manutenção",
  pneus_vida_util_baixa: "Pneus",
  sinistros_recorrentes: "Sinistros",
  multas_pontos_acumulados: "Multas",
  aprovacoes_paradas: "Aprovações",
  seguro_vencendo: "Seguro",
  documentos_motorista_vencendo: "Motoristas",
};

export function CardInsightIA({ insight }: { insight: InsightIA }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [oculto, setOculto] = useState(false);

  function marcarLido() {
    setErro(null);
    startTransition(async () => {
      const resultado = await marcarInsightLidoAcao(insight.id);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  function dispensar() {
    if (!confirm("Dispensar este insight? Ele não vai reaparecer sozinho, mesmo se o cron rodar de novo amanhã.")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await dispensarInsightAcao(insight.id);
      if (resultado.erro) setErro(resultado.erro);
      else setOculto(true);
    });
  }

  if (oculto) return null;

  return (
    <div className={`card p-4 ${insight.status === "novo" ? "border-frota-200" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={SEVERIDADE_BADGE[insight.severidade] ?? "badge-atencao"}>{insight.severidade}</span>
            <span className="text-xs uppercase tracking-wide text-slate-400">
              {CATEGORIA_LABEL[insight.categoria] ?? insight.categoria}
            </span>
            {insight.status === "novo" && <span className="badge-ativo">Novo</span>}
          </div>
          <p className="text-sm font-semibold text-slate-900">{insight.titulo}</p>
          <p className="mt-1 text-sm text-slate-600">{insight.descricao}</p>
          {insight.recomendacao && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-medium">Recomendação: </span>
              {insight.recomendacao}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {insight.valor_impacto_estimado !== null && (
              <span>Impacto estimado: {formatarMoeda(insight.valor_impacto_estimado)}</span>
            )}
            <span>Gerado em {new Date(insight.gerado_em).toLocaleDateString("pt-BR")}</span>
          </div>
          {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
        </div>

        <div className="flex shrink-0 gap-2">
          {insight.status === "novo" && (
            <button type="button" onClick={marcarLido} disabled={isPending} className="btn-secondary text-xs">
              Marcar como lido
            </button>
          )}
          <button
            type="button"
            onClick={dispensar}
            disabled={isPending}
            className="text-xs font-medium text-slate-500 hover:underline"
          >
            Dispensar
          </button>
        </div>
      </div>
    </div>
  );
}
