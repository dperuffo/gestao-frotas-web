"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarMotorista, atualizarMotorista } from "../actions";
import { CLASSIFICACAO } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type Motorista = Database["public"]["Tables"]["motoristas"]["Row"];
type EmpresaOpcao = { id: string; nome: string };
type CentroCustoOpcao = { id: string; nome: string };

export function MotoristaForm({
  motorista,
  empresas,
  centrosCusto,
  nomeEmpresaAtual,
}: {
  motorista?: Motorista;
  empresas: EmpresaOpcao[];
  centrosCusto: CentroCustoOpcao[];
  nomeEmpresaAtual?: string;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = motorista
        ? await atualizarMotorista(motorista.id, undefined, formData)
        : await criarMotorista(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Dados do motorista</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nome completo" required>
            <input name="nome_completo" required defaultValue={motorista?.nome_completo ?? ""} className="input" />
          </Campo>
          <Campo label="CPF" required>
            <input name="cpf" required defaultValue={motorista?.cpf ?? ""} className="input" />
          </Campo>
          <Campo label="Telefone">
            <input name="telefone" defaultValue={motorista?.telefone ?? ""} className="input" />
          </Campo>
          <Campo label="E-mail">
            <input type="email" name="email" defaultValue={motorista?.email ?? ""} className="input" />
          </Campo>
          <Campo label="Classificação">
            <select name="classificacao" defaultValue={motorista?.classificacao ?? "Próprio"} className="input">
              {CLASSIFICACAO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="CNH (número)">
            <input name="cnh" defaultValue={motorista?.cnh ?? ""} className="input" />
          </Campo>
          <Campo label="CNH — vencimento">
            <input
              type="date"
              name="cnh_vencimento"
              defaultValue={motorista?.cnh_vencimento ?? ""}
              className="input"
            />
          </Campo>
          <Campo label="Centro de custo">
            <select name="centro_custo_id" defaultValue={motorista?.centro_custo_id ?? ""} className="input">
              <option value="">Nenhum</option>
              {centrosCusto.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
          {!motorista && (
            <Campo label="Cliente" required>
              <select name="empresa_id" required defaultValue="" className="input">
                <option value="" disabled>
                  Selecione o cliente...
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>

        {motorista && (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={motorista.status === "Ativo"}
              className="h-4 w-4 rounded border-slate-300"
            />
            Motorista ativo
          </label>
        )}

        {motorista && nomeEmpresaAtual && (
          <p className="mt-4 text-xs text-slate-500">Cliente: {nomeEmpresaAtual} (não pode ser alterado aqui).</p>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : motorista ? "Salvar alterações" : "Cadastrar Motorista"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
