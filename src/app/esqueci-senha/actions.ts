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
// (Fase 27.7). Reaproveita o mesmo /auth/callback já usado no login com
// Google (troca o "code" do link por uma sessão válida) — só muda o "next"
// pra cair em /redefinir-senha em vez de /dashboard.
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
    redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
  });

  // Não revela se o e-mail existe ou não na base (evita enumeração de
  // contas) — sempre responde sucesso, só loga o erro real no servidor.
  if (error) {
    console.error("[esqueci-senha] erro ao solicitar recuperação:", error.message);
  }
  return { sucesso: true };
}
