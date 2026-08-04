"use client";

import { useState, useTransition } from "react";
import {
  criarAgendamentoAcao,
  reagendarAcao,
  confirmarAgendamentoAcao,
  cancelarAgendamentoAcao,
} from "../actions";
import { STATUS_AGENDAMENTO_LABEL, STATUS_AGENDAMENTO_COR, TIPO_AGENDAMENTO_LABEL } from "@/lib/agendamentosPatio";

// Fase agendamento-patio (04/08/2026, item 8 do benchmark FNI vs KMM, Grupo
// 2) — card de agendamento de UMA ponta do frete (coleta OU entrega),
// pensado pra viver dentro de /fretes/[id]. Sem agendamento ainda: formulário
// compacto de criação. Com agendamento: badge de status + ações (confirmar,
// reagendar, cancelar). "em_andamento"/"concluido" são preenchidos sozinhos
// pela RPC registrar_evento_frete quando o motorista bate o checkpoint —
// aqui não existe botão de "check-in", só de agendar/confirmar/cancelar.
export type AgendamentoPatio = {
  id: string;
  doca: string | null;
  janela_inicio: string;
  janela_fim: string;
  status: string;
  observacoes: string | null;
};

function paraInputDatetimeLocal(iso: string): string {
  // datetime-local não aceita segundos/fuso — corta pro formato que o
  // input espera, mantendo a hora local que veio do banco.
  const data = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function formatarJanela(inicio: string, fim: string): string {
  const i = new Date(inicio);
  const f = new Date(fim);
  const dataFmt = i.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const horaI = i.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const horaF = f.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataFmt}, ${horaI}–${horaF}`;
}

export function AgendamentoPatioCard({
  freteId,
  empresaId,
  tipo,
  localLabelPadrao,
  agendamento,
}: {
  freteId: string;
  empresaId: string;
  tipo: "coleta" | "entrega";
  localLabelPadrao: string;
  agendamento: AgendamentoPatio | null;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCriar(formData: FormData) {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await criarAgendamentoAcao(freteId, empresaId, tipo, localLabelPadrao, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function handleReagendar(formData: FormData) {
    if (!agendamento) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await reagendarAcao(agendamento.id, freteId, empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setEditando(false);
    });
  }

  function handleConfirmar() {
    if (!agendamento) return;
    startTransition(() => confirmarAgendamentoAcao(agendamento.id, freteId));
  }

  function handleCancelar() {
    if (!agendamento) return;
    if (!confirm(`Cancelar o agendamento de ${TIPO_AGENDAMENTO_LABEL[tipo].toLowerCase()}?`)) return;
    startTransition(() => cancelarAgendamentoAcao(agendamento.id, freteId));
  }

  const podeEditar = agendamento && ["agendado", "confirmado"].includes(agendamento.status);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">{TIPO_AGENDAMENTO_LABEL[tipo]}</p>

      {!agendamento || editando ? (
        <form action={editando ? handleReagendar : handleCriar} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Início da janela</label>
            <input
              type="datetime-local"
              name="janela_inicio"
              required
              defaultValue={editando && agendamento ? paraInputDatetimeLocal(agendamento.janela_inicio) : undefined}
              className="input text-sm"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Fim da janela</label>
            <input
              type="datetime-local"
              name="janela_fim"
              required
              defaultValue={editando && agendamento ? paraInputDatetimeLocal(agendamento.janela_fim) : undefined}
              className="input text-sm"
            />
          </div>
          <div className="min-w-[100px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Doca/vaga</label>
            <input
              type="text"
              name="doca"
              placeholder="Opcional"
              defaultValue={editando ? agendamento?.doca ?? "" : ""}
              className="input text-sm"
            />
          </div>
          {!editando && (
            <input type="hidden" name="local_label" value={localLabelPadrao} />
          )}
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Observações</label>
            <input
              type="text"
              name="observacoes"
              placeholder="Opcional"
              defaultValue={editando ? agendamento?.observacoes ?? "" : ""}
              className="input text-sm"
            />
          </div>
          <button type="submit" disabled={isPending} className="btn-secondary text-sm">
            {isPending ? "..." : editando ? "Salvar" : "Agendar"}
          </button>
          {editando && (
            <button type="button" onClick={() => setEditando(false)} className="text-sm text-slate-500 hover:underline">
              Cancelar edição
            </button>
          )}
          {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_AGENDAMENTO_COR[agendamento.status] ?? "bg-slate-100 text-slate-600"}`}>
            {STATUS_AGENDAMENTO_LABEL[agendamento.status] ?? agendamento.status}
          </span>
          <span className="text-sm text-slate-700">{formatarJanela(agendamento.janela_inicio, agendamento.janela_fim)}</span>
          {agendamento.doca && <span className="text-sm text-slate-500">· doca {agendamento.doca}</span>}
          {agendamento.observacoes && <span className="text-xs text-slate-400">· {agendamento.observacoes}</span>}

          {podeEditar && (
            <span className="ml-auto flex items-center gap-2">
              {agendamento.status === "agendado" && (
                <button type="button" onClick={handleConfirmar} disabled={isPending} className="text-sm text-blue-600 hover:underline">
                  Confirmar
                </button>
              )}
              <button type="button" onClick={() => setEditando(true)} disabled={isPending} className="text-sm text-slate-600 hover:underline">
                Reagendar
              </button>
              <button type="button" onClick={handleCancelar} disabled={isPending} className="text-sm text-red-600 hover:underline">
                Cancelar
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
