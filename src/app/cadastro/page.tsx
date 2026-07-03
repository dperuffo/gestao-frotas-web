"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { criarContaTrial } from "./actions";
import { DIAS_TRIAL } from "@/lib/constants";
import { AuthShell, AuthCard } from "@/components/AuthShell";

// Cadastro self-service — prospect vindo da landing pública
// (fxgestaodefrotasonline.com) cria a própria conta e já entra em trial,
// sem depender de um admin da FNI convidar. Rota fora do grupo (dashboard),
// liberada como pública no middleware (ver src/lib/supabase/middleware.ts).
//
// Visual: mesmo design system das telas de login/MFA (AuthShell, variante
// "compact" — o formulário já é longo, então o herói completo do login
// ficaria grande demais aqui).
export default function CadastroPage() {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = await criarContaTrial(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <AuthShell variant="compact" maxWidthClassName="max-w-lg">
      <AuthCard>
        <h2 className="text-center text-lg font-semibold text-white">
          Comece grátis no FNI Pro-Frotas
        </h2>
        <p className="mb-6 text-center text-sm text-slate-400">
          Crie sua conta e experimente por {DIAS_TRIAL} dias, sem cartão de crédito.
        </p>

        {erro && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{erro}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Campo label="Nome da empresa" required>
            <input
              name="nome_empresa"
              required
              className="input-dark"
              placeholder="Razão social ou nome fantasia"
            />
          </Campo>

          <Campo label="CNPJ">
            <input name="cnpj" className="input-dark" placeholder="00.000.000/0001-00 (opcional)" />
          </Campo>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Seu nome" required>
              <input name="nome_contato" required className="input-dark" />
            </Campo>
            <Campo label="Telefone">
              <input name="telefone" className="input-dark" placeholder="(00) 00000-0000" />
            </Campo>
          </div>

          <Campo label="E-mail" required>
            <input
              name="email"
              type="email"
              required
              className="input-dark"
              placeholder="voce@empresa.com"
            />
          </Campo>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Senha" required>
              <input name="senha" type="password" required minLength={8} className="input-dark" />
            </Campo>
            <Campo label="Confirmar senha" required>
              <input
                name="confirmar_senha"
                type="password"
                required
                minLength={8}
                className="input-dark"
              />
            </Campo>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              name="aceite_termos"
              required
              className="mt-0.5 accent-frota-500"
            />
            <span>Li e aceito os termos de uso e a política de privacidade do FNI Pro-Frotas.</span>
          </label>

          <button type="submit" disabled={isPending} className="btn-primary w-full justify-center">
            {isPending ? "Criando conta..." : "Criar minha conta grátis"}
          </button>
        </form>
      </AuthCard>

      <p className="mt-6 text-center text-xs text-slate-500">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-medium text-frota-400 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
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
      <label className="label-dark">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {children}
    </div>
  );
}
