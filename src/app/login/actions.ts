"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registrarAcessoCliente } from "@/lib/acessosClientes";

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
