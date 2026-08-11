"use client";

import { useState, useTransition } from "react";
import { atualizarCustoFixoAcao, excluirCustoFixoAcao } from "../actions";
import { formatarMoeda, formatarDataSemFuso, TIPOS_CUSTO_FIXO, TIPO_CUSTO_FIXO_LABEL, type TipoCustoFixo } from "@/lib/financeiro";

export type LinhaCustoFixo = {
  id: string;
  tipo: string;
  valor: number;
  competencia: string;
  descricao: string | null;
  placa: string | null;
  centroCustoId: string | null;
  origem: string;
  editavel: boolean;
};

// Fase Financeiro-Fretes — pedido do Daniel: "Parcelas de fretes pagos
// popular painel financeiro em despesas". Lançamentos com origem 'frete'
// vêm de marcar_pagamento_frete (adiantamento/saldo final confirmados como
// pagos em Fretes) — mesmo badge visual de "Integração" pros demais
// automáticos (origem 'api'), mas com rótulo e cor próprios pra deixar
// claro de onde veio.
//
// Achado real (02/08/2026) — mesmo padrão pra origem 'plano_viagem': lançado
// automaticamente pelo trigger trg_lancar_diarias_viagem_financeiro quando um
// Plano de Viagem é concluído com diárias de refeição/pernoite/banho/lavagem.
function badgeOrigem(origem: string) {
  if (origem === "frete") return { classe: "badge-ativo", label: "Frete" };
  // Fase Fretes-Cancelamento-Pagamento (11/08/2026) — lançamento que ERA
  // "Frete" normal, mas o frete foi cancelado DEPOIS de já pago (ver
  // cancelar_frete). Não some nem zera — só fica identificável separado,
  // com destaque de alerta.
  if (origem === "frete_cancelado")
    return { classe: "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700", label: "⚠️ Perda (frete cancelado)" };
  if (origem === "plano_viagem") return { classe: "badge-ativo", label: "Plano de Viagem" };
  if (origem === "api") return { classe: "badge-ativo", label: "Integração" };
  return { classe: "badge-atencao", label: "Manual" };
}

// Tabela "Últimos custos fixos lançados" com edição/exclusão inline — só
// habilitada pra lançamentos do mês vigente (flag `editavel`, calculada em
// page.tsx comparando a competência com o mês/ano atuais). Fora do mês
// vigente a linha fica só leitura, pra não alterar um fechamento de mês já
// passado direto por aqui.
export function TabelaCustosFixos({ linhas }: { linhas: LinhaCustoFixo[] }) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{
    tipo: TipoCustoFixo;
    valor: string;
    competencia: string;
    descricao: string;
    placa: string;
    centroCustoId: string;
  } | null>(null);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function iniciarEdicao(l: LinhaCustoFixo) {
    setErro(undefined);
    setEditandoId(l.id);
    setRascunho({
      tipo: l.tipo as TipoCustoFixo,
      valor: String(l.valor),
      competencia: l.competencia.slice(0, 10),
      descricao: l.descricao ?? "",
      placa: l.placa ?? "",
      centroCustoId: l.centroCustoId ?? "",
    });
  }

  function salvarEdicao(id: string) {
    if (!rascunho) return;
    const valor = Number(rascunho.valor);
    if (!TIPOS_CUSTO_FIXO.includes(rascunho.tipo)) {
      setErro("Tipo inválido.");
      return;
    }
    if (!Number.isFinite(valor) || valor < 0) {
      setErro("Valor inválido.");
      return;
    }
    if (!rascunho.competencia) {
      setErro("Informe a competência.");
      return;
    }
    setErro(undefined);
    startTransition(async () => {
      const resultado = await atualizarCustoFixoAcao(id, {
        tipo: rascunho.tipo,
        valor,
        competencia: rascunho.competencia,
        descricao: rascunho.descricao.trim() || null,
        placa: rascunho.placa.trim().toUpperCase() || null,
        centro_custo_id: rascunho.centroCustoId || null,
        recorrente: false,
      });
      if (resultado?.erro) setErro(resultado.erro);
      else setEditandoId(null);
    });
  }

  function excluir(id: string) {
    if (!confirm("Excluir este custo fixo?")) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await excluirCustoFixoAcao(id);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div>
      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3">Placa</th>
            <th className="px-4 py-3">Competência</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Origem</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((l) => {
            const emEdicao = editandoId === l.id && rascunho;
            const origem = badgeOrigem(l.origem);
            return (
              <tr key={l.id}>
                {emEdicao ? (
                  <>
                    <td className="px-4 py-3">
                      <select
                        value={rascunho.tipo}
                        onChange={(e) => setRascunho({ ...rascunho, tipo: e.target.value as TipoCustoFixo })}
                        className="input py-1 text-sm"
                      >
                        {TIPOS_CUSTO_FIXO.map((t) => (
                          <option key={t} value={t}>
                            {TIPO_CUSTO_FIXO_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={rascunho.descricao}
                        onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
                        className="input py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={rascunho.placa}
                        onChange={(e) => setRascunho({ ...rascunho, placa: e.target.value })}
                        className="input w-24 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={rascunho.competencia}
                        onChange={(e) => setRascunho({ ...rascunho, competencia: e.target.value })}
                        className="input py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={rascunho.valor}
                        onChange={(e) => setRascunho({ ...rascunho, valor: e.target.value })}
                        className="input w-28 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={origem.classe}>{origem.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => salvarEdicao(l.id)}
                          disabled={isPending}
                          className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditandoId(null)}
                          disabled={isPending}
                          className="text-xs font-medium text-slate-500 hover:underline disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-slate-600">{TIPO_CUSTO_FIXO_LABEL[l.tipo as TipoCustoFixo] ?? l.tipo}</td>
                    <td className="px-4 py-3 text-slate-600">{l.descricao ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{l.placa ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatarDataSemFuso(l.competencia)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatarMoeda(l.valor)}</td>
                    <td className="px-4 py-3">
                      <span className={origem.classe}>{origem.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {l.editavel ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(l)}
                            disabled={isPending}
                            className="text-xs font-medium text-frota-600 hover:underline disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluir(l.id)}
                            disabled={isPending}
                            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Fora do mês vigente</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                Nenhum custo fixo lançado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
