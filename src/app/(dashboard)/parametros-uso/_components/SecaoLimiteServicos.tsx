"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ModalRegra } from "./ModalRegra";
import { ToggleStatusRegra, ExcluirRegra } from "./AcoesRegra";
import { criarLimiteServicos, alternarStatusLimiteServicos, excluirLimiteServicos } from "../actions";

const SERVICOS = ["Lavagem", "Lubrificação", "Restaurante", "Banheiro", "Estacionamento", "Hotel/Pousada", "Internet/Wi-Fi", "Outros"];

type LimiteItem = { servico: string; qtd_maxima: number | null; valor_maximo: number | null };
type Linha = {
  id: string;
  placa: string | null;
  postos_cnpj: string[];
  limites: LimiteItem[];
  status: string;
  observacao: string | null;
  motoristas: { nome_completo: string } | null;
};
type VeiculoOpcao = { placa: string; marca: string | null; modelo: string | null };
type MotoristaOpcao = { id: string; nome_completo: string; cpf: string };
type PostoOpcao = { cnpj: string; nome: string };

export function SecaoLimiteServicos({
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
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await criarLimiteServicos(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setModalAberto(false);
    });
  }

  return (
    <div>
      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Quantidade (UN) e valor máximo (R$) permitidos por serviço (lavagem, restaurante etc.), filtrados por
            cliente, veículo, motorista e posto. Campos em branco = sem restrição.
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
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Itens com limite</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{l.placa ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">{l.motoristas?.nome_completo ?? "Todos"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {l.limites
                    .map(
                      (i) =>
                        `${i.servico} (${[i.qtd_maxima ? `${i.qtd_maxima} un` : null, i.valor_maximo ? `R$ ${i.valor_maximo}` : null].filter(Boolean).join(" / ")})`
                    )
                    .join(", ")}
                </td>
                <td className="px-4 py-3">
                  <span className={l.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{l.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleStatusRegra id={l.id} ativo={l.status === "Ativo"} acao={alternarStatusLimiteServicos} />
                    <ExcluirRegra id={l.id} acao={excluirLimiteServicos} />
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

      <ModalRegra titulo="Nova Regra — Limite de Serviços" aberto={modalAberto} onFechar={() => setModalAberto(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          <input type="hidden" name="empresa_id" value={empresaId} />

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

          {postos.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Postos aplicáveis</label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {postos.map((p) => (
                  <label key={p.cnpj} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="postos_cnpj" value={p.cnpj} className="h-4 w-4 rounded border-slate-300" />
                    {p.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Limites por serviço</label>
            <div className="space-y-2">
              {SERVICOS.map((s) => (
                <div key={s} className="grid grid-cols-3 items-center gap-2 text-sm">
                  <span className="text-slate-600">{s}</span>
                  <input type="hidden" name="servico" value={s} />
                  <input type="number" name="qtd_maxima" min={0} placeholder="Qtd. máx. (UN)" className="input" />
                  <input
                    type="number"
                    name="valor_maximo_servico"
                    min={0}
                    step="0.01"
                    placeholder="Valor máx. (R$)"
                    className="input"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Preencha apenas os serviços que deseja limitar.</p>
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
