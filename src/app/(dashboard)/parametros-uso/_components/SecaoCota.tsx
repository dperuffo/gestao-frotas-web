"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "./ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "./AcoesRegra";
import { criarCota, alternarStatusCota, excluirCota } from "../actions";

const PERIODICIDADE_LABEL: Record<string, string> = {
  Abastecimento: "Por abastecimento",
  Semana: "Por semana",
  Quinzena: "Por quinzena",
  Mes: "Por mês",
};

type Linha = {
  id: string;
  placa: string;
  tipo: string;
  limite: number;
  periodicidade: string;
  status: string;
  observacao: string | null;
  consumido: number;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };

function formatarValor(tipo: string, n: number) {
  return tipo === "Valor" ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : `${n} L`;
}

export function SecaoCota({
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
      const resultado = await criarCota(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Limite de consumo por veículo (R$ ou litros), com periodicidade. O abastecimento é bloqueado quando a
            cota é excedida e renovada automaticamente no início de cada período.
          </p>
          <button type="button" onClick={() => setModalAberto(true)} className="btn-primary shrink-0">
            + Nova Cota
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Limite</th>
              <th className="px-4 py-3">Consumido (período atual)</th>
              <th className="px-4 py-3">Periodicidade</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{l.placa}</td>
                <td className="px-4 py-3 text-slate-600">{l.tipo === "Valor" ? "Valor (R$)" : "Volume (L)"}</td>
                <td className="px-4 py-3 text-slate-600">{formatarValor(l.tipo, l.limite)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatarValor(l.tipo, l.consumido)}{" "}
                  <span className={l.consumido >= l.limite ? "text-red-600" : "text-slate-400"}>
                    ({Math.min(100, Math.round((l.consumido / l.limite) * 100))}%)
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{PERIODICIDADE_LABEL[l.periodicidade] ?? l.periodicidade}</td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusCota} />
                    <ExcluirRegra id={l.id} acao={excluirCota} />
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma cota cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModalRegra titulo="Nova Cota por Veículo" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <input type="hidden" name="empresa_id" value={empresaId} />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Veículo (placa) *</label>
            <select name="placa" required defaultValue="" className="input">
              <option value="" disabled>
                Selecione um veículo...
              </option>
              {veiculos.map((v) => (
                <option key={v.placa} value={v.placa}>
                  {v.placa}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de cota</label>
              <select name="tipo" defaultValue="Valor" className="input">
                <option value="Valor">Valor (R$)</option>
                <option value="Volume">Volume (L)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Limite *</label>
              <input type="number" name="limite" min={0.01} step="0.01" required className="input" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Periodicidade</label>
            <select name="periodicidade" defaultValue="Mes" className="input">
              <option value="Abastecimento">Por abastecimento (limite por evento)</option>
              <option value="Semana">Por semana (7 dias)</option>
              <option value="Quinzena">Por quinzena (15 dias)</option>
              <option value="Mes">Por mês (mês corrente)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Observação</label>
            <textarea name="observacao" rows={2} className="input" />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? "Salvando..." : "Salvar Cota"}
            </button>
          </div>
        </form>
      </ModalRegra>
    </div>
  );
}
