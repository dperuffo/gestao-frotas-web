"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarClienteAcao, editarClienteAcao } from "../../actions";

export type ClienteValores = {
  cnpjCpf: string;
  razaoSocial: string;
  ie: string | null;
  enderecoLogradouro: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  enderecoMunicipio: string | null;
  enderecoUf: string | null;
  enderecoCep: string | null;
  telefone: string | null;
  email: string | null;
};

export function ClienteForm({
  empresaId,
  modo,
  clienteId,
  valoresIniciais,
}: {
  empresaId: string;
  modo: "criar" | "editar";
  clienteId?: string;
  valoresIniciais?: ClienteValores;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado =
        modo === "criar"
          ? await criarClienteAcao(empresaId, undefined, formData)
          : await editarClienteAcao(clienteId!, empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else if (modo === "editar") {
        setSucesso(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Dados salvos.</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Identificação</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              CNPJ ou CPF{modo === "criar" && <span className="text-red-500"> *</span>}
            </label>
            {modo === "criar" ? (
              <input name="cnpj_cpf" required maxLength={18} className="input" placeholder="Só números ou formatado" />
            ) : (
              <input value={valoresIniciais?.cnpjCpf ?? ""} disabled className="input bg-slate-50 text-slate-500" />
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Razão social / Nome<span className="text-red-500"> *</span>
            </label>
            <input name="razao_social" required defaultValue={valoresIniciais?.razaoSocial} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Inscrição estadual</label>
            <input name="ie" defaultValue={valoresIniciais?.ie ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
            <input name="telefone" defaultValue={valoresIniciais?.telefone ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
            <input name="email" type="email" defaultValue={valoresIniciais?.email ?? ""} className="input" />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Endereço</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Logradouro</label>
            <input name="endereco_logradouro" defaultValue={valoresIniciais?.enderecoLogradouro ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Número</label>
            <input name="endereco_numero" defaultValue={valoresIniciais?.enderecoNumero ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Bairro</label>
            <input name="endereco_bairro" defaultValue={valoresIniciais?.enderecoBairro ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Município</label>
            <input name="endereco_municipio" defaultValue={valoresIniciais?.enderecoMunicipio ?? ""} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">UF</label>
            <input name="endereco_uf" maxLength={2} defaultValue={valoresIniciais?.enderecoUf ?? ""} className="input uppercase" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">CEP</label>
            <input name="endereco_cep" defaultValue={valoresIniciais?.enderecoCep ?? ""} className="input" />
          </div>
        </div>
      </section>

      <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
        {isPending ? "Salvando..." : modo === "criar" ? "Cadastrar cliente" : "Salvar alterações"}
      </button>
    </form>
  );
}
