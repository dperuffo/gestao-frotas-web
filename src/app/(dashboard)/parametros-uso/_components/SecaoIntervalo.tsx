"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "./ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "./AcoesRegra";
import { criarIntervalo, alternarStatusIntervalo, excluirIntervalo } from "../actions";

type Linha = {
  id: string;
  tipo: string;
  placa: string | null;
  intervalo_minimo: number;
  unidade: string;
  status: string;
  observacao: string | null;
  motoristas: { nome_completo: string } | null;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };
type MotoristaOpcao = { id: string; nome_completo: string; cpf: string | null };

export function SecaoIntervalo({
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
  const [tipo, setTipo] = useState<"Veiculo" | "Motorista">("Veiculo");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarIntervalo(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Intervalo mínimo obrigatório entre dois abastecimentos consecutivos, por veículo ou motorista. O
            sistema bloqueia o registro se o intervalo for menor que o definido.
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
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Referência</th>
              <th className="px-4 py-3">Intervalo mínimo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Observação</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{l.tipo === "Veiculo" ? "Veículo" : "Motorista"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {l.tipo === "Veiculo" ? (l.placa ?? "Todos") : (l.motoristas?.nome_completo ?? "Todos")}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {l.intervalo_minimo} {l.unidade === "Horas" ? "hora(s)" : "dia(s)"}
                </td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.observacao ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusIntervalo} />
                    <ExcluirRegra id={l.id} acao={excluirIntervalo} />
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma regra de intervalo cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ModalRegra titulo="Nova Regra de Intervalo" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <input type="hidden" name="empresa_id" value={empresaId} />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de regra *</label>
            <select
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "Veiculo" | "Motorista")}
              className="input"
            >
              <option value="Veiculo">Por Veículo</option>
              <option value="Motorista">Por Motorista</option>
            </select>
          </div>

          {tipo === "Veiculo" ? (
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
          ) : (
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
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Intervalo mínimo *</label>
              <input type="number" name="intervalo_minimo" min={1} required className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Unidade</label>
              <select name="unidade" defaultValue="Horas" className="input">
                <option value="Horas">Horas</option>
                <option value="Dias">Dias</option>
              </select>
            </div>
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
