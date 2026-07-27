"use client";

import { useState, useTransition, type FormEvent, type FocusEvent } from "react";
import { convidarColega, verificarCpfDuplicadoColega } from "../actions";

export function ConvidarColegaForm({ empresaId, vagasEsgotadas }: { empresaId: string; vagasEsgotadas: boolean }) {
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  // Fase tratamento-cnpj-cpf (27/07/2026) — aviso NÃO bloqueante: só avisa
  // se o CPF já pertence a outra conta, não impede o convite.
  const [avisoCpf, setAvisoCpf] = useState<string | undefined>();

  function handleBlurCpf(e: FocusEvent<HTMLInputElement>) {
    const cpf = e.target.value.trim();
    setAvisoCpf(undefined);
    if (!cpf) return;
    startTransition(async () => {
      const { duplicado } = await verificarCpfDuplicadoColega(cpf);
      if (duplicado) setAvisoCpf("Este CPF já está cadastrado em outra conta do sistema.");
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await convidarColega(empresaId, undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      if (resultado?.sucesso) {
        setSucesso(resultado.sucesso);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sucesso}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome completo" required>
          <input name="nome" required disabled={vagasEsgotadas} className="input disabled:bg-slate-100" />
        </Campo>
        <Campo label="E-mail" required>
          <input type="email" name="email" required disabled={vagasEsgotadas} className="input disabled:bg-slate-100" />
        </Campo>
        <Campo label="CPF">
          <input name="cpf" disabled={vagasEsgotadas} onBlur={handleBlurCpf} className="input disabled:bg-slate-100" />
          {avisoCpf && <p className="mt-1 text-xs text-amber-600">{avisoCpf}</p>}
        </Campo>
        <Campo label="Telefone">
          <input name="telefone" disabled={vagasEsgotadas} className="input disabled:bg-slate-100" />
        </Campo>
      </div>

      <p className="text-xs text-slate-500">
        O colega recebe um e-mail para criar a própria senha e entra com perfil &quot;Colaborador&quot; — o que
        ele pode ver e fazer é configurado em Permissões.
      </p>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending || vagasEsgotadas} className="btn-primary">
          {isPending ? "Convidando..." : "Convidar colega"}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
