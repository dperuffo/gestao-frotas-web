"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "./ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "./AcoesRegra";
import { criarValorDiario, alternarStatusValorDiario, excluirValorDiario } from "../actions";

type Linha = {
  id: string;
  valor_maximo: number;
  status: string;
  observacao: string | null;
  motoristas: { nome_completo: string } | null;
};
type MotoristaOpcao = { id: string; nome_completo: string; cpf: string };

export function SecaoValorDiario({
  linhas,
  empresaId,
  motoristas,
}: {
  linhas: Linha[];
  empresaId: string;
  motoristas: MotoristaOpcao[];
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarValorDiario(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Valor máximo (R$) que um motorista pode gastar em abastecimentos em um único dia. Ao atingir o
            limite, o registro é bloqueado com a mensagem &quot;Valor Diário Excedido&quot;.
          </p>
          <button type="button" onClick={() => setModalAberto(true)} className="btn-primary shrink-0">
            + Nova Regra
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Valor máximo diário</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{l.motoristas?.nome_completo ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {l.valor_maximo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.observacao ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusValorDiario} />
                    <ExcluirRegra id={l.id} acao={excluirValorDiario} />
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma regra cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModalRegra titulo="Nova Regra — Valor Diário" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <input type="hidden" name="empresa_id" value={empresaId} />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Motorista</label>
            <select name="motorista_id" defaultValue="" className="input">
              <option value="">Todos os motoristas (regra geral)</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome_completo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Valor máximo diário (R$) *</label>
            <input type="number" name="valor_maximo" min={0.01} step="0.01" required className="input" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Observação</label>
            <textarea name="observacao" rows={2} className="input" />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? "Salvando..." : "Salvar Regra"}
            </button>
          </div>
        </form>
      </ModalRegra>
    </div>
  );
}
