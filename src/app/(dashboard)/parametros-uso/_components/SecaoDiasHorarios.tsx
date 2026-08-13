"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "./ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "./AcoesRegra";
import { criarDiasHorarios, alternarStatusDiasHorarios, excluirDiasHorarios } from "../actions";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type Linha = {
  id: string;
  classificacao: string | null;
  placa: string | null;
  dias_permitidos: string[];
  hora_inicio: string;
  hora_fim: string;
  status: string;
  observacao: string | null;
  motoristas: { nome_completo: string } | null;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };
type MotoristaOpcao = { id: string; nome_completo: string; cpf: string | null };

export function SecaoDiasHorarios({
  linhas,
  empresaId,
  veiculos,
  motoristas,
}: {
  linhas: Linha[];
  empresaId: string;
  veiculos: VeiculoOpcao[];
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
      const resultado = await criarDiasHorarios(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Dias da semana e horário em que o abastecimento é permitido, por cliente, veículo, classificação e
            motorista. Fora da janela definida, o abastecimento é bloqueado.
          </p>
          <button type="button" onClick={() => setModalAberto(true)} className="btn-primary shrink-0">
            + Nova Restrição
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Classificação</th>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Dias permitidos</th>
              <th className="px-4 py-3">Horário</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-frota-50/60">
                <td className="px-4 py-3 text-slate-600">{l.classificacao ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">{l.placa ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">{l.motoristas?.nome_completo ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">{l.dias_permitidos.join(", ")}</td>
                <td className="px-4 py-3 text-slate-600">
                  {l.hora_inicio.slice(0, 5)}–{l.hora_fim.slice(0, 5)}
                </td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusDiasHorarios} />
                    <ExcluirRegra id={l.id} acao={excluirDiasHorarios} />
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma restrição cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModalRegra titulo="Nova Restrição de Horário" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <input type="hidden" name="empresa_id" value={empresaId} />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Classificação</label>
            <select name="classificacao" defaultValue="" className="input">
              <option value="">Todos</option>
              <option value="Leve">Leve</option>
              <option value="Pesado">Pesado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Veículo (placa)</label>
            <select name="placa" defaultValue="" className="input">
              <option value="">Todos os veículos</option>
              {veiculos.map((v) => (
                <option key={v.placa} value={v.placa}>
                  {v.placa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Motorista</label>
            <select name="motorista_id" defaultValue="" className="input">
              <option value="">Todos os motoristas</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome_completo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Dias permitidos *</label>
            <div className="flex flex-wrap gap-3">
              {DIAS.map((d) => (
                <label key={d} className="flex items-center gap-1 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="dias_permitidos"
                    value={d}
                    defaultChecked={["Seg", "Ter", "Qua", "Qui", "Sex"].includes(d)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hora início *</label>
              <input type="time" name="hora_inicio" required defaultValue="06:00" className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hora fim *</label>
              <input type="time" name="hora_fim" required defaultValue="20:00" className="input" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Observação</label>
            <textarea name="observacao" rows={2} className="input" />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? "Salvando..." : "Salvar Restrição"}
            </button>
          </div>
        </form>
      </ModalRegra>
    </div>
  );
}
