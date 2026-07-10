"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "./ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "./AcoesRegra";
import { criarProduto, alternarStatusProduto, excluirProduto } from "../actions";

const COMBUSTIVEIS = ["Diesel", "Arla 32 + Diesel", "Gasolina", "Etanol", "Flex", "GNV", "GLP", "Elétrico"];

type Linha = {
  id: string;
  placa: string | null;
  combustiveis_permitidos: string[];
  status: string;
  observacao: string | null;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };

export function SecaoProduto({
  linhas,
  empresaId,
  veiculos,
}: {
  linhas: Linha[];
  empresaId: string;
  veiculos: VeiculoOpcao[];
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarProduto(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Combustíveis permitidos por veículo. Se nenhum for marcado na regra, o sistema usa o combustível
            especificado no cadastro do veículo.
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
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Combustíveis permitidos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{l.placa ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {l.combustiveis_permitidos.length > 0 ? l.combustiveis_permitidos.join(", ") : "Do cadastro"}
                </td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.observacao ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusProduto} />
                    <ExcluirRegra id={l.id} acao={excluirProduto} />
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

      <ModalRegra titulo="Nova Regra — Produto Abastecido" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <input type="hidden" name="empresa_id" value={empresaId} />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Veículo (placa)</label>
            <select name="placa" defaultValue="" className="input">
              <option value="">Todos os veículos (regra geral)</option>
              {veiculos.map((v) => (
                <option key={v.placa} value={v.placa}>
                  {v.placa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Combustíveis permitidos</label>
            <div className="grid grid-cols-2 gap-2">
              {COMBUSTIVEIS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="combustiveis_permitidos" value={c} className="h-4 w-4 rounded border-slate-300" />
                  {c}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Nenhum marcado = usa o combustível do cadastro do veículo.</p>
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
