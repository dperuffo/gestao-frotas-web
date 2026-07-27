"use client";

import { useState, useTransition, type FormEvent, type FocusEvent } from "react";
import { criarUsuario, atualizarUsuario, verificarCpfDuplicadoUsuario } from "../actions";
import { PERFIS, PERFIL_LABEL, SEGMENTO_USUARIO } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type Usuario = Database["public"]["Tables"]["usuarios_app"]["Row"];
type EmpresaOpcao = { id: string; nome: string };

export function UsuarioForm({
  usuario,
  empresas,
  empresaAtualId,
}: {
  usuario?: Usuario;
  empresas: EmpresaOpcao[];
  empresaAtualId?: string;
}) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  // Fase tratamento-cnpj-cpf (27/07/2026) — aviso NÃO bloqueante: só avisa
  // se o CPF já pertence a outra conta, não impede salvar.
  const [avisoCpf, setAvisoCpf] = useState<string | undefined>();

  function handleBlurCpf(e: FocusEvent<HTMLInputElement>) {
    const cpf = e.target.value.trim();
    setAvisoCpf(undefined);
    if (!cpf) return;
    startTransition(async () => {
      const { duplicado } = await verificarCpfDuplicadoUsuario(cpf, usuario?.email);
      if (duplicado) setAvisoCpf("Este CPF já está cadastrado em outra conta do sistema.");
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = usuario
        ? await atualizarUsuario(usuario.email, undefined, formData)
        : await criarUsuario(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Dados do usuário</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nome completo" required>
            <input name="nome" required defaultValue={usuario?.nome ?? ""} className="input" />
          </Campo>
          <Campo label="E-mail" required>
            <input
              type="email"
              name="email"
              required
              disabled={!!usuario}
              defaultValue={usuario?.email ?? ""}
              className="input disabled:bg-slate-100 disabled:text-slate-500"
            />
          </Campo>
          <Campo label="CPF">
            <input name="cpf" defaultValue={usuario?.cpf ?? ""} onBlur={handleBlurCpf} className="input" />
            {avisoCpf && <p className="mt-1 text-xs text-amber-600">{avisoCpf}</p>}
          </Campo>
          <Campo label="Telefone">
            <input name="telefone" defaultValue={usuario?.telefone ?? ""} className="input" />
          </Campo>
          <Campo label="Perfil de acesso" required>
            <select name="perfil" required defaultValue={usuario?.perfil ?? "gestor_frota"} className="input">
              {PERFIS.map((p) => (
                <option key={p} value={p}>
                  {PERFIL_LABEL[p]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Segmento">
            <select name="segmento" defaultValue={usuario?.segmento ?? ""} className="input">
              <option value="">Selecione...</option>
              {SEGMENTO_USUARIO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Campo>
          {!usuario && (
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

        {usuario && (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="ativo" defaultChecked={usuario.ativo} className="h-4 w-4 rounded border-slate-300" />
            Usuário ativo
          </label>
        )}

        {!usuario && (
          <p className="mt-4 text-xs text-slate-500">
            Ao salvar, um e-mail de convite é enviado automaticamente pelo Supabase Auth para o
            usuário definir sua própria senha. A ativação do segundo fator (MFA) é feita pelo
            próprio usuário no primeiro acesso.
          </p>
        )}

        {usuario && empresaAtualId && (
          <p className="mt-4 text-xs text-slate-500">
            Vínculo de cliente é gerenciado na tela de Grupo Econômico / Clientes — este formulário
            atualiza apenas os dados de perfil do usuário.
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Salvando..." : usuario ? "Salvar alterações" : "Convidar Usuário"}
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
