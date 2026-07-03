"use client";

import { Suspense, useState, useTransition, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, AuthCard } from "@/components/AuthShell";
import { entrarComSenha } from "./actions";

// Login via Supabase Auth nativo. Duas formas de entrar:
// 1) "Entrar com Google" (Google OAuth) — cobre qualquer domínio no Google
//    Workspace, não só @gmail.com.
// 2) E-mail + senha — necessário pra quem se cadastrou pelo /cadastro (que
//    já cria a conta com e-mail+senha) mas cujo e-mail corporativo NÃO é
//    Google Workspace (ex.: Microsoft 365). Sem essa opção, esse cliente
//    conseguia criar a conta mas nunca mais conseguia entrar de novo
//    (achado real — Fase 27.7).
//
// Visual: segue o design system da FNI (fundo bg-frota-950 + logo grande
// no topo via AuthShell/AuthLogoHeader), pra deixar claro que é o ambiente
// oficial e seguro da plataforma — mesmo padrão visual da landing page
// (fxgestaodefrotasonline.com).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  );
}

function LoginCard() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(mensagemDeErro(searchParams.get("erro")));

  async function handleGoogleLogin() {
    setErro(null);
    setCarregandoGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setErro("Não foi possível iniciar o login com Google. Tente novamente.");
      setCarregandoGoogle(false);
    }
    // Em caso de sucesso, o navegador é redirecionado para o Google — não há mais nada a fazer aqui.
  }

  function handleSenhaSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const resultado = await entrarComSenha(undefined, formData);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <AuthShell variant="full">
      <AuthCard>
        <h2 className="text-center text-lg font-semibold text-white">Entrar na plataforma</h2>
        <p className="mb-6 text-center text-sm text-slate-400">
          Entre com sua conta Google ou com e-mail e senha.
        </p>

        {erro && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-left text-sm text-red-300">
            {erro}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={carregandoGoogle}
          className="btn-secondary w-full justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.6 0-14.2 4.3-17.7 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.4 26.8 36 24 36c-5.2 0-9.6-3.1-11.3-7.6l-6.6 5.1C9.7 39.6 16.3 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C39.9 37 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          {carregandoGoogle ? "Redirecionando..." : "Entrar com Google"}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-wide text-slate-500">ou</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSenhaSubmit} className="space-y-3">
          <div>
            <label className="label-dark">E-mail</label>
            <input name="email" type="email" required autoComplete="email" className="input-dark" placeholder="voce@empresa.com" />
          </div>
          <div>
            <label className="label-dark">Senha</label>
            <input name="senha" type="password" required autoComplete="current-password" className="input-dark" />
          </div>
          <button type="submit" disabled={isPending} className="btn-primary w-full justify-center">
            {isPending ? "Entrando..." : "Entrar com e-mail e senha"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Após o login, será solicitada a verificação em duas etapas (MFA).
        </p>
      </AuthCard>

      <p className="mt-6 text-center text-xs text-slate-500">
        Ainda não tem conta?{" "}
        <a href="/cadastro" className="font-medium text-frota-400 hover:underline">
          Comece seu teste grátis de 14 dias
        </a>
      </p>
    </AuthShell>
  );
}

function mensagemDeErro(codigo: string | null): string | null {
  if (!codigo) return null;
  if (codigo === "oauth") {
    return "Não foi possível concluir o login com Google. Verifique se as chaves do Supabase em .env.local estão corretas e tente novamente.";
  }
  return "Ocorreu um erro ao entrar. Tente novamente.";
}
