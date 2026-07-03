"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIAS_TRIAL, LIMITES_PLANO } from "@/lib/constants";

export type CadastroFormState = { erro?: string } | undefined;

async function origemAtual(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Cadastro self-service (prospect vindo da landing pública) — cria a conta
// no Supabase Auth e, na sequência, a empresa em trial + o vínculo do
// usuário. Como o usuário acabou de nascer (ainda não pertence a nenhuma
// empresa), o bootstrap de empresas/usuarios_app/usuarios_empresas precisa
// do cliente admin (service role) — a RLS dessas tabelas exige já pertencer
// a uma empresa pra poder inserir nelas, exatamente como o convite manual em
// /usuarios/novo já faz.
export async function criarContaTrial(_prev: CadastroFormState, formData: FormData): Promise<CadastroFormState> {
  const nomeEmpresa = String(formData.get("nome_empresa") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").trim() || null;
  const nomeContato = String(formData.get("nome_contato") ?? "").trim();
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const confirmarSenha = String(formData.get("confirmar_senha") ?? "");
  const aceite = formData.get("aceite_termos") === "on";

  if (!nomeEmpresa || !nomeContato || !email || !senha) {
    return { erro: "Preencha nome da empresa, seu nome, e-mail e senha." };
  }
  if (senha.length < 8) {
    return { erro: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (senha !== confirmarSenha) {
    return { erro: "As senhas não coincidem." };
  }
  if (!aceite) {
    return { erro: "É necessário aceitar os termos de uso para continuar." };
  }

  const supabase = await createClient();
  const origin = await origemAtual();

  // 1) Conta no Supabase Auth — endpoint público padrão de signUp, então
  // respeita a configuração de confirmação de e-mail do projeto. Se o
  // e-mail já existir, o Auth retorna erro aqui (não deixamos passar pro
  // bootstrap da empresa nesse caso).
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { nome: nomeContato },
    },
  });

  if (signUpError) {
    const msg = signUpError.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user_already_exists")) {
      return { erro: "Já existe uma conta com este e-mail. Faça login ou recupere sua senha." };
    }
    return { erro: `Não foi possível criar a conta: ${signUpError.message}` };
  }

  const usuarioCriado = signUpData.user;
  if (!usuarioCriado) {
    return { erro: "Não foi possível criar a conta. Tente novamente em instantes." };
  }

  // 2) Empresa em trial + perfil + vínculo (bootstrap via admin, ver nota acima).
  const admin = createAdminClient();
  const limites = LIMITES_PLANO.gratuito;
  const trialEndsAt = new Date(Date.now() + DIAS_TRIAL * 24 * 60 * 60 * 1000).toISOString();

  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .insert({
      nome: nomeEmpresa,
      cnpj,
      status: "trial",
      plano: "gratuito",
      trial_ends_at: trialEndsAt,
      max_usuarios: limites.max_usuarios,
      max_veiculos: limites.max_veiculos,
      telefone_contato: telefone,
      email_contato: email,
    })
    .select("id")
    .single();

  if (empresaError || !empresa) {
    return {
      erro: `Sua conta foi criada, mas houve um erro ao configurar a empresa (${empresaError?.message ?? "erro desconhecido"}). Fale com o suporte informando o e-mail usado.`,
    };
  }

  const { error: perfilError } = await admin.from("usuarios_app").upsert(
    { email, nome: nomeContato, telefone, perfil: "gestor_frota", segmento: "Frota", ativo: true },
    { onConflict: "email" }
  );
  if (perfilError) {
    return {
      erro: `Empresa criada, mas houve erro ao salvar seu perfil (${perfilError.message}). Fale com o suporte.`,
    };
  }

  const { error: vinculoError } = await admin
    .from("usuarios_empresas")
    .upsert({ user_email: email, empresa_id: empresa.id, role: "gestor_frota", ativo: true });
  if (vinculoError) {
    return {
      erro: `Perfil salvo, mas houve erro ao vincular à empresa (${vinculoError.message}). Fale com o suporte.`,
    };
  }

  // Se a confirmação de e-mail estiver ativa no projeto, signUp não retorna
  // sessão (o usuário só consegue logar depois de clicar no link recebido) —
  // manda pra tela explicando isso. Caso contrário, os cookies de sessão já
  // foram setados pelo signUp acima e cai direto no dashboard, que vai pedir
  // o cadastro do MFA antes de liberar qualquer tela.
  if (!signUpData.session) {
    redirect("/cadastro/verifique-email");
  }
  redirect("/dashboard");
}
