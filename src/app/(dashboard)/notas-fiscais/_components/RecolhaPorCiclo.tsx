import Link from "next/link";
import { formatarDataBr } from "@/lib/utils";
import { corDoPercentual } from "./IndicadorNotasFiscais";

// Fase NFE-1 — pedido do Daniel: "ajustar a aplicação para apresentar o
// percentual de recolha por ciclo, seja o status que ele estiver". Antes só
// existia 1 indicador global de "últimos 90 dias" (janela rolante, sem
// noção de ciclo de faturamento). Agora 1 card por ciclo de cada negociação
// (posto↔cliente): o ciclo aberto atual + os últimos fechados, com o %
// calculado só com os abastecimentos daquele período específico — dados
// vêm da RPC nfe_recolha_por_ciclo() (mesmo espírito de agregação no banco
// que indicador_notas_fiscais() já usava, ver Fase 27.95).
export type CicloNfe = {
  negociacaoId: string;
  postoNome: string;
  clienteNome: string;
  faturaPostoId: string | null;
  status: string;
  periodoInicio: string;
  periodoFim: string;
  vencimento: string;
  total: number;
  comNota: number;
  semNota: number;
  rejeitadas: number;
  percentual: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Ciclo aberto",
  fechada: "Fechada",
  a_vencer: "A vencer",
  vencida: "Vencida",
  paga: "Paga",
  cancelada: "Cancelada",
};

const STATUS_COR: Record<string, string> = {
  aberto: "bg-blue-50 text-blue-700",
  fechada: "bg-slate-100 text-slate-600",
  a_vencer: "bg-amber-100 text-amber-700",
  vencida: "bg-red-100 text-red-700",
  paga: "bg-green-100 text-green-700",
  cancelada: "bg-slate-200 text-slate-500",
};

export function RecolhaPorCiclo({
  ciclos,
  ehPosto,
  cicloSelecionado,
  linkParaCiclo,
}: {
  ciclos: CicloNfe[];
  ehPosto: boolean;
  cicloSelecionado: { negociacaoId: string; periodoInicio: string; periodoFim: string } | null;
  linkParaCiclo: (c: CicloNfe) => string;
}) {
  if (ciclos.length === 0) {
    return (
      <div className="mb-6 card p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Recolha de notas fiscais por ciclo</h3>
        <p className="text-sm text-slate-500">Nenhum ciclo de faturamento encontrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Recolha de notas fiscais por ciclo</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ciclos.map((c) => {
          const selecionado =
            cicloSelecionado?.negociacaoId === c.negociacaoId &&
            cicloSelecionado?.periodoInicio === c.periodoInicio &&
            cicloSelecionado?.periodoFim === c.periodoFim;
          const percentual = c.percentual ?? 0;
          const cor = corDoPercentual(percentual);
          return (
            <Link
              key={`${c.negociacaoId}-${c.periodoInicio}`}
              href={linkParaCiclo(c)}
              className={`card block p-4 transition ${
                selecionado ? "ring-2 ring-frota-500" : "hover:border-frota-300"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{ehPosto ? c.clienteNome : c.postoNome}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_COR[c.status] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <p className="mb-2 text-xs text-slate-500">
                {formatarDataBr(c.periodoInicio)} – {formatarDataBr(c.periodoFim)} · vencimento{" "}
                {formatarDataBr(c.vencimento)}
              </p>
              {c.total === 0 ? (
                <p className="text-xs text-slate-400">Sem abastecimentos neste ciclo ainda.</p>
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">
                      {c.comNota} de {c.total} com NF-e
                      {c.rejeitadas > 0 && (
                        <span className="text-red-600">
                          {" "}
                          · {c.rejeitadas} rejeitada{c.rejeitadas === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-bold" style={{ color: cor }}>
                      {percentual.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, percentual))}%`, backgroundColor: cor }}
                    />
                  </div>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
