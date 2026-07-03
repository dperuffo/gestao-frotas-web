"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type EsqueciSenhaState = { erro?: string; sucesso?: boolean } | undefined;

async function origemAtual(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Fase 27.9 — recuperação de senha, complementar ao login por e-mail/senha
// (Fase 27.7).
//
// Fase 27.16 — trocado de /auth/callback pra /auth/confirm: o link de
// recuperação também sofria do mesmo problema do link de confirmação de
// cadastro (aberto num navegador/dispositivo diferente do que fez o pedido,
// quebrando a troca de "code" via PKCE — ver auth/confirm/route.ts pro
// motivo completo). `redirectTo` aqui só serve de fallback padrão: o link
// que realmente sai no e-mail depende do template "Reset Password"
// configurado no Supabase Dashboard (ver README, Fase 27.16).
export async function solicitarRecuperacaoSenha(
  _prev: EsqueciSenhaState,
  formData: FormData
): Promise<EsqueciSenhaState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { erro: "Informe seu e-mail." };
  }

  const supabase = await createClient();
  const origin = await origemAtual();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?type=recovery&next=/redefinir-senha`,
  });

  // Não revela se o e-mail existe ou não na base (evita enumeração de
  // contas) — sempre responde sucesso, só loga o erro real no servidor.
  if (error) {
    console.error("[esqueci-senha] erro ao solicitar recuperação:", error.message);
  }
  return { sucesso: true };
}
