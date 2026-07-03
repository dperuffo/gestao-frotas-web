"use client";

import { useState, useTransition, type FormEvent } from "react";
import { criarPosto, atualizarPosto } from "../actions";
import type { Database } from "@/types/database.types";

type Posto = Database["public"]["Tables"]["postos_gf"]["Row"];
type EmpresaOpcao = { id: string; nome: string };

export function PostoForm({
  posto,
  empresas,
  nomeEmpresaAtual,
}: {
  posto?: Posto;
  empresas: EmpresaOpcao[];
  nomeEmpresaAtual?: string;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = posto
        ? await atualizarPosto(posto.cnpj, undefined, formData)
        : await criarPosto(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="CNPJ" required>
            <input
              name="cnpj"
              required
              disabled={!!posto}
              defaultValue={posto?.cnpj ?? ""}
              className="input disabled:bg-slate-100 disabled:text-slate-500"
            />
          </Campo>
          <Campo label="Razão social">
            <input name="razao_social" defaultValue={posto?.razao_social ?? ""} className="input" />
          </Campo>
          <Campo label="Distribuidora">
            <input name="distribuidora" defaultValue={posto?.distribuidora ?? ""} className="input" />
          </Campo>
          <Campo label="Município">
            <input name="municipio" defaultValue={posto?.municipio ?? ""} className="input" />
          </Campo>
          <Campo label="UF">
            <input name="uf" maxLength={2} defaultValue={posto?.uf ?? ""} className="input" />
          </Campo>
          <Campo label="Latitude">
            <input type="number" step="0.000001" name="lat" defaultValue={posto?.lat ?? ""} className="input" />
          </Campo>
          <Campo label="Longitude">
            <input type="number" step="0.000001" name="lon" defaultValue={posto?.lon ?? ""} className="input" />
          </Campo>
          <Campo label="Perfil de venda">
            <input name="perfil_venda" defaultValue={posto?.perfil_venda ?? ""} className="input" />
          </Campo>
          <Campo label="Horário de funcionamento">
            <input name="horario" placeholder="Ex: 06h às 22h" defaultValue={posto?.horario ?? ""} className="input" />
          </Campo>
          {!posto && (
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
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Estrutura</h2>
        <div className="flex flex-wrap gap-6">
          <Checkbox name="funciona_24h" label="Funciona 24h" defaultChecked={posto?.funciona_24h ?? false} />
          <Checkbox name="pista_caminhao" label="Pista para caminhão" defaultChecked={posto?.pista_caminhao ?? false} />
          <Checkbox name="arla" label="Vende ARLA 32" defaultChecked={posto?.arla ?? false} />
          <Checkbox name="conveniencia" label="Tem loja de conveniência" defaultChecked={posto?.conveniencia ?? false} />
        </div>

        {posto && nomeEmpresaAtual && (
          <p className="mt-4 text-xs text-slate-500">Cliente: {nomeEmpresaAtual} (não pode ser alterado aqui).</p>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : posto ? "Salvar alterações" : "Cadastrar Posto"}
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

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300" />
      {label}
    </label>
  );
}
