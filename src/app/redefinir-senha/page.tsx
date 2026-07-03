"use client";

import { useState, useTransition, type FormEvent } from "react";
import { AuthShell, AuthCard } from "@/components/AuthShell";
import { redefinirSenha } from "./actions";

export default function RedefinirSenhaPage() {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await redefinirSenha(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <AuthShell variant="full">
      <AuthCard>
        <h2 className="text-center text-lg font-semibold text-white">Definir nova senha</h2>
        <p className="mb-6 text-center text-sm text-slate-400">Escolha uma nova senha para sua conta.</p>

        {erro && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-left text-sm text-red-300">{erro}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-dark">Nova senha</label>
            <input name="senha" type="password" required minLength={8} autoComplete="new-password" className="input-dark" />
          </div>
          <div>
            <label className="label-dark">Confirmar nova senha</label>
            <input name="confirmar_senha" type="password" required minLength={8} autoComplete="new-password" className="input-dark" />
          </div>
          <button type="submit" disabled={isPending} className="btn-primary w-full justify-center">
            {isPending ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
