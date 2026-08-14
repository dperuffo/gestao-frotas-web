import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// Fase 27.16 — achado real: um cliente novo se cadastrou, recebeu o e-mail
// de confirmação, clicou no link e caiu numa tela de erro dizendo "Não foi
// possível concluir o login com Google. Verifique as chaves do Supabase em
// .env.local" — uma mensagem completamente errada (ele nunca usou Google, só
// e-mail/senha). Causa raiz: o link de confirmação de cadastro (e também o
// de "esqueci minha senha") apontava pro mesmo /auth/callback que o OAuth do
// Google usa, que troca um "code" por sessão via exchangeCodeForSession —
// esse método exige um cookie "code_verifier" (PKCE) salvo no MESMO
// navegador que iniciou o cadastro. Cliente comum normalmente abre o e-mail
// de confirmação em outro navegador/aba/dispositivo (ex.: cadastrou no
// notebook, confirmou pelo Gmail no celular) — o cookie não existe aí, a
// troca falha, e o app mostrava o erro genérico de OAuth por engano.
//
// Esta rota resolve isso pro caso de e-mail: usa verifyOtp com token_hash
// (não depende de cookie nenhum — funciona em qualquer navegador/dispositivo,
// é o padrão recomendado pela própria Supabase pra esse cenário). Só entra
// em uso, porém, depois que os templates "Confirm signup" e "Reset Password"
// forem atualizados no Supabase Dashboard pra apontar pra cá em vez do link
// padrão {{ .ConfirmationURL }} — ver README (Fase 27.16) pro texto exato.
// /auth/callback continua existindo exatamente como está, só para o OAuth do
// Google (onde o navegador nunca troca — não tem esse problema).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/dashboard";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    void logger.error("auth/confirm", "Falha ao verificar o token", error);
  }

  return NextResponse.redirect(`${origin}/login?erro=confirmacao`);
}
