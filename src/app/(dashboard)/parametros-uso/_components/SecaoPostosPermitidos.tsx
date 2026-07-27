"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "./ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "./AcoesRegra";
import { criarPostosPermitidos, alternarStatusPostosPermitidos, excluirPostosPermitidos } from "../actions";

type Linha = {
  id: string;
  classificacao: string | null;
  placa: string | null;
  postos_cnpj: string[];
  tipo_limite: string;
  valor_maximo: number | null;
  status: string;
  observacao: string | null;
  motoristas: { nome_completo: string } | null;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };
type MotoristaOpcao = { id: string; nome_completo: string; cpf: string | null };
type PostoOpcao = { cnpj: string; nome: string };

export function SecaoPostosPermitidos({
  linhas,
  empresaId,
  veiculos,
  motoristas,
  postos,
}: {
  linhas: Linha[];
  empresaId: string;
  veiculos: VeiculoOpcao[];
  motoristas: MotoristaOpcao[];
  postos: PostoOpcao[];
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoLimite, setTipoLimite] = useState("Sem limite");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function nomePosto(cnpj: string) {
    return postos.find((p) => p.cnpj === cnpj)?.nome ?? cnpj;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarPostosPermitidos(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Restringe o abastecimento a postos autorizados, por cliente, veículo ou motorista, com limite de
            valor/volume opcional. A lista de postos vem das negociações já feitas com a rede.
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
              <th className="px-4 py-3">Postos permitidos</th>
              <th className="px-4 py-3">Limite</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{l.classificacao ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">{l.placa ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">{l.motoristas?.nome_completo ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">{l.postos_cnpj.map(nomePosto).join(", ")}</td>
                <td className="px-4 py-3 text-slate-600">
                  {l.tipo_limite === "Sem limite"
                    ? "Sem limite"
                    : `${l.tipo_limite === "Valor" ? "R$" : "L"} ${l.valor_maximo ?? "—"}`}
                </td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusPostosPermitidos} />
                    <ExcluirRegra id={l.id} acao={excluirPostosPermitidos} />
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

      <ModalRegra titulo="Nova Restrição de Posto" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Postos permitidos *</label>
            {postos.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhum posto negociado ainda — feche uma negociação em &quot;Negociações com Postos&quot; primeiro.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {postos.map((p) => (
                  <label key={p.cnpj} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="postos_cnpj" value={p.cnpj} className="h-4 w-4 rounded border-slate-300" />
                    {p.nome}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de limite</label>
            <select
              name="tipo_limite"
              value={tipoLimite}
              onChange={(e) => setTipoLimite(e.target.value)}
              className="input"
            >
              <option value="Sem limite">Sem limite</option>
              <option value="Valor">Valor máximo (R$)</option>
              <option value="Volume">Volume máximo (L)</option>
            </select>
          </div>

          {tipoLimite !== "Sem limite" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Valor máximo</label>
              <input type="number" name="valor_maximo" min={0.01} step="0.01" className="input" />
            </div>
          )}

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
