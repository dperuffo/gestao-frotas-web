"use client";

import { Suspense, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, AuthCard } from "@/components/AuthShell";
import { InputSenha } from "@/components/InputSenha";
import { entrarComSenha, entrarComGoogle } from "./actions";

// Login via Supabase Auth nativo. Duas formas de entrar:
// 1) "Entrar com Google" — cobre qualquer domínio no Google Workspace, não
//    só @gmail.com.
// 2) E-mail + senha — necessário pra quem se cadastrou pelo /cadastro (que
//    já cria a conta com e-mail+senha) mas cujo e-mail corporativo NÃO é
//    Google Workspace (ex.: Microsoft 365). Sem essa opção, esse cliente
//    conseguia criar a conta mas nunca mais conseguia entrar de novo
//    (achado real — Fase 27.7).
//
// Fase 27.45 — o login com Google não usa mais o redirect hospedado pelo
// Supabase (supabase.auth.signInWithOAuth). Naquele fluxo, a tela de
// consentimento do Google mostra "Continuar para nedthbeekvwzcjrhsghp.supabase.co"
// (o domínio do projeto Supabase — é o redirect_uri real registrado no
// Google Cloud), o que é confuso pro cliente ver o domínio técnico do banco
// de dados em vez de fxgestaodefrotasonline.com. Agora o app pede o ID
// token direto ao Google usando o Google Identity Services (GIS), no
// próprio domínio da aplicação, e só então valida esse token no Supabase
// via signInWithIdToken (ver ./actions.ts). Precisa de duas coisas
// configuradas fora do código (ver DEPLOY.md / README):
//   1) env var NEXT_PUBLIC_GOOGLE_CLIENT_ID = o mesmo Client ID que já está
//      em Authentication > Providers > Google no painel do Supabase;
//   2) esse mesmo OAuth Client, no Google Cloud Console, precisa ter
//      "https://fxgestaodefrotasonline.com" em "Authorized JavaScript origins".
// Se a env var não estiver configurada (ex.: ambiente local sem ela) ou o
// script do Google falhar/demorar demais pra carregar, cai automaticamente
// no botão antigo (redirect via Supabase) — login nunca fica quebrado.
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

type CredencialGoogle = { credential: string };

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (resposta: CredencialGoogle) => void;
    nonce?: string;
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(
    pai: HTMLElement,
    opcoes: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      logo_alignment?: "left" | "center";
    }
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Gera o nonce exigido pelo signInWithIdToken do Supabase: um valor
// aleatório (nonceCru) que só o hash (sha-256) dele é enviado ao Google —
// depois o Supabase confere que o hash dentro do ID token bate com esse
// nonce cru, o que impede reaproveitar um token roubado/interceptado.
async function gerarNonce(): Promise<{ nonceCru: string; nonceHash: string }> {
  const nonceCru = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonceCru));
  const nonceHash = Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { nonceCru, nonceHash };
}

function LoginCard() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [carregandoGoogle, setCarregandoGoogle] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(mensagemDeErro(searchParams.get("erro")));

  // Estado do botão "novo" (GIS). Enquanto não estiver pronto (ou se falhar),
  // mostramos o botão antigo (redirect via Supabase) — nunca os dois juntos.
  const [googlePronto, setGooglePronto] = useState(false);
  const [googleFalhou, setGoogleFalhou] = useState(false);
  const botaoGoogleRef = useRef<HTMLDivElement>(null);
  const nonceCruRef = useRef<string>("");

  const usarGis = Boolean(GOOGLE_CLIENT_ID) && !googleFalhou;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setGoogleFalhou(true);
      return;
    }
    // Se em 6s o script/botão do Google não tiver carregado, assume que
    // falhou (rede lenta, bloqueador de script, etc.) e cai no botão antigo.
    const tempoLimite = setTimeout(() => {
      setGooglePronto((jaPronto) => {
        if (!jaPronto) setGoogleFalhou(true);
        return jaPronto;
      });
    }, 6000);
    return () => clearTimeout(tempoLimite);
  }, []);

  function handleCredencialGoogle(resposta: CredencialGoogle) {
    setErro(null);
    startTransition(async () => {
      const resultado = await entrarComGoogle(resposta.credential, nonceCruRef.current);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function inicializarBotaoGoogle() {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id || !botaoGoogleRef.current) return;
    gerarNonce().then(({ nonceCru, nonceHash }) => {
      nonceCruRef.current = nonceCru;
      window.google!.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredencialGoogle,
        nonce: nonceHash,
        use_fedcm_for_prompt: true,
      });
      window.google!.accounts.id.renderButton(botaoGoogleRef.current!, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 336,
        logo_alignment: "left",
      });
      setGooglePronto(true);
    });
  }

  // Botão antigo — fallback: redirect hospedado pelo Supabase. Cobre o caso
  // de a env var do Google Client ID não estar configurada, ou o script do
  // GIS falhar/demorar (rede, bloqueador, etc.).
  async function handleGoogleLoginFallback() {
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
      {usarGis && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={inicializarBotaoGoogle}
          onError={() => setGoogleFalhou(true)}
        />
      )}

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

        {usarGis ? (
          <div className="flex justify-center">
            <div ref={botaoGoogleRef} />
            {!googlePronto && (
              <div className="h-10 w-full animate-pulse rounded-lg bg-white/10" aria-hidden="true" />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGoogleLoginFallback}
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
        )}

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
            <div className="flex items-center justify-between">
              <label className="label-dark">Senha</label>
              <a href="/esqueci-senha" className="text-xs font-medium text-frota-500 hover:underline">
                Esqueci minha senha
              </a>
            </div>
            <InputSenha name="senha" required autoComplete="current-password" />
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
        <a href="/cadastro" className="font-medium text-frota-500 hover:underline">
          Comece seu teste grátis de 14 dias
        </a>
      </p>
    </AuthShell>
  );
}

function mensagemDeErro(codigo: string | null): string | null {
  if (!codigo) return null;
  if (codigo === "oauth") {
    return "Não foi possível concluir o login com Google. Tente novamente ou entre com e-mail e senha.";
  }
  // Fase 27.16 — link de confirmação de cadastro (ou de "esqueci minha
  // senha") expirado, já usado, ou aberto num navegador diferente do que
  // originou o pedido. Mensagem própria, separada da de OAuth — antes as
  // duas caíam no mesmo "erro=oauth" e mostravam um texto sobre Google que
  // não tinha nada a ver com o problema real de quem só usa e-mail/senha.
  if (codigo === "confirmacao") {
    return "Este link expirou ou já foi utilizado. Solicite um novo e-mail e tente novamente.";
  }
  return "Ocorreu um erro ao entrar. Tente novamente.";
}
