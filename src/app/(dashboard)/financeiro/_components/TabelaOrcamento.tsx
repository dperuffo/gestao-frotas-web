"use client";

import { useState, useTransition } from "react";
import { atualizarOrcamentoAcao, excluirOrcamentoAcao } from "../actions";
import { formatarMoeda, CATEGORIA_ORCAMENTO_LABEL, type CategoriaOrcamento } from "@/lib/financeiro";

export type LinhaOrcamento = {
  id: string;
  centroCustoNome: string;
  categoria: CategoriaOrcamento;
  valorPlanejado: number;
  realizado: number;
};

// Tabela "Orçamento do mês por categoria" com edição/exclusão inline. Os
// orçamentos aqui já vêm filtrados pelo mês/ano vigente (a query em
// page.tsx só busca ano/mês atuais), então toda linha pode ser editada —
// diferente da tabela de custos fixos, que mostra lançamentos de qualquer
// mês e por isso trava edição fora do mês vigente. Só o valor planejado é
// editável (categoria/centro de custo mudariam a identidade do orçamento —
// pra isso o usuário lança um orçamento novo no formulário abaixo).
export function TabelaOrcamento({ linhas }: { linhas: LinhaOrcamento[] }) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [valorEdicao, setValorEdicao] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function iniciarEdicao(l: LinhaOrcamento) {
    setErro(undefined);
    setEditandoId(l.id);
    setValorEdicao(String(l.valorPlanejado));
  }

  function salvarEdicao(id: string) {
    const valor = Number(valorEdicao);
    if (!Number.isFinite(valor) || valor < 0) {
      setErro("Valor inválido.");
      return;
    }
    setErro(undefined);
    startTransition(async () => {
      const resultado = await atualizarOrcamentoAcao(id, valor, null);
      if (resultado?.erro) setErro(resultado.erro);
      else setEditandoId(null);
    });
  }

  function excluir(id: string) {
    if (!confirm("Excluir este orçamento?")) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await excluirOrcamentoAcao(id);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div>
      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Centro de custo</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Planejado</th>
            <th className="px-4 py-3">Realizado</th>
            <th className="px-4 py-3">Saldo</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((l) => {
            const emEdicao = editandoId === l.id;
            const valorPlanejadoAtual = emEdicao ? Number(valorEdicao) || 0 : l.valorPlanejado;
            const saldo = valorPlanejadoAtual - l.realizado;
            return (
              <tr key={l.id}>
                <td className="px-4 py-3 text-slate-600">{l.centroCustoNome}</td>
                <td className="px-4 py-3 text-slate-600">{CATEGORIA_ORCAMENTO_LABEL[l.categoria] ?? l.categoria}</td>
                <td className="px-4 py-3 text-slate-600">
                  {emEdicao ? (
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      autoFocus
                      value={valorEdicao}
                      onChange={(e) => setValorEdicao(e.target.value)}
                      className="input w-28 py-1 text-sm"
                    />
                  ) : (
                    formatarMoeda(l.valorPlanejado)
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{formatarMoeda(l.realizado)}</td>
                <td className={`px-4 py-3 font-medium ${saldo < 0 ? "text-red-600" : "text-green-700"}`}>
                  {formatarMoeda(saldo)}
                </td>
                <td className="px-4 py-3">
                  {emEdicao ? (
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
                  ) : (
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
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
