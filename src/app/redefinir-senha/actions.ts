"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RedefinirSenhaState = { erro?: string } | undefined;

// Fase 27.9 — chega aqui só depois de clicar no link recebido por e-mail:
// /auth/callback já trocou o "code" do link por uma sessão válida (ver
// solicitarRecuperacaoSenha em esqueci-senha/actions.ts), então o usuário já
// está autenticado quando esta tela carrega — só falta definir a nova senha.
export async function redefinirSenha(_prev: RedefinirSenhaState, formData: FormData): Promise<RedefinirSenhaState> {
  const senha = String(formData.get("senha") ?? "");
  const confirmarSenha = String(formData.get("confirmar_senha") ?? "");

  if (senha.length < 8) {
    return { erro: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (senha !== confirmarSenha) {
    return { erro: "As senhas não coincidem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { erro: "Link de recuperação inválido ou expirado. Solicite um novo em \"Esqueci minha senha\"." };
  }

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return { erro: `Não foi possível atualizar a senha: ${error.message}` };
  }

  redirect("/dashboard");
}
