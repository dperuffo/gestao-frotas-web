"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registrarAcessoCliente } from "@/lib/acessosClientes";
import { logger } from "@/lib/logger";

export type LoginFormState = { erro?: string } | undefined;

// Fase 27.7 — login por e-mail/senha, complementar ao "Entrar com Google".
// Existia uma lacuna real: o cadastro self-service (/cadastro) já cria a
// conta com e-mail+senha (funciona pra qualquer domínio de e-mail, inclusive
// corporativo), mas até aqui /login só oferecia OAuth do Google — cliente
// com e-mail corporativo que não é Google Workspace (ex.: Microsoft 365)
// conseguia se cadastrar, mas não tinha como entrar de novo depois.
export async function entrarComSenha(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials")) {
      return { erro: "E-mail ou senha incorretos." };
    }
    if (msg.includes("email not confirmed")) {
      return { erro: "Confirme seu e-mail antes de entrar — verifique sua caixa de entrada (e o spam)." };
    }
    return { erro: "Não foi possível entrar. Tente novamente em instantes." };
  }

  await registrarAcessoCliente(supabase, email);
  redirect("/dashboard");
}

// Fase 27.45 — login com Google via Google Identity Services (GIS), direto
// no domínio da aplicação, no lugar do redirect hospedado pelo Supabase
// (supabase.auth.signInWithOAuth). Motivo: no fluxo antigo, a tela de
// consentimento do Google mostra "Continuar para nedthbeekvwzcjrhsghp.supabase.co"
// (o domínio do projeto Supabase, que é o redirect_uri real registrado no
// Google Cloud) em vez de fxgestaodefrotasonline.com — visualmente estranho
// pro cliente. Aqui o app pede o ID token direto ao Google, no seu próprio
// domínio (via GIS no client), e só então valida esse token aqui no
// servidor com signInWithIdToken — sem passar pelo redirect do Supabase.
//
// O "nonce" evita replay: o client gera um valor aleatório, manda pro Google
// só o hash (sha-256) dele, e aqui a gente confirma que o valor cru bate com
// o hash que veio dentro do ID token (o próprio signInWithIdToken faz essa
// checagem).
export async function entrarComGoogle(idToken: string, nonceCru: string): Promise<LoginFormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce: nonceCru,
  });

  if (error) {
    // Fase Observabilidade-Fundacao (14/08/2026) — migrado pro logger
    // estruturado como demonstração do padrão novo (ver src/lib/logger.ts).
    await logger.error("login", "Falha ao validar ID token do Google", error);
    return { erro: "Não foi possível entrar com Google. Tente novamente." };
  }

  await registrarAcessoCliente(supabase, data.user?.email);
  redirect("/dashboard");
}
