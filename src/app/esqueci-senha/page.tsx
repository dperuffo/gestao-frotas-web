"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell, AuthCard } from "@/components/AuthShell";
import { solicitarRecuperacaoSenha } from "./actions";

export default function EsqueciSenhaPage() {
  const [erro, setErro] = useState<string | undefined>();
  const [enviado, setEnviado] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await solicitarRecuperacaoSenha(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
      else setEnviado(true);
    });
  }

  return (
    <AuthShell variant="full">
      <AuthCard>
        <h2 className="text-center text-lg font-semibold text-white">Esqueci minha senha</h2>
        <p className="mb-6 text-center text-sm text-slate-400">
          Informe seu e-mail e enviaremos um link para você redefinir a senha.
        </p>

        {erro && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-left text-sm text-red-300">{erro}</div>
        )}

        {enviado ? (
          <div className="rounded-lg bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
            Se houver uma conta com esse e-mail, enviamos um link de redefinição de senha. Confira sua caixa de
            entrada (e o spam).
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label-dark">E-mail</label>
              <input name="email" type="email" required autoComplete="email" className="input-dark" placeholder="voce@empresa.com" />
            </div>
            <button type="submit" disabled={isPending} className="btn-primary w-full justify-center">
              {isPending ? "Enviando..." : "Enviar link de redefinição"}
            </button>
          </form>
        )}
      </AuthCard>

      <p className="mt-6 text-center text-xs text-slate-500">
        <Link href="/login" className="font-medium text-frota-400 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthShell>
  );
}
