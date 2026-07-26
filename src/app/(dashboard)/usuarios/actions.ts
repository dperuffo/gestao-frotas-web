"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UsuarioFormState = { erro?: string } | undefined;

// Achado real de segurança (26/07/2026, investigando um 404 reportado pelo
// Daniel): estas actions usam o cliente ADMIN (bypassa RLS) pra convidar/
// criar usuário, mas nunca checavam quem estava chamando — qualquer perfil
// autenticado (inclusive "gestor_frota" ou "posto", que nem deveriam ver
// esta tela) conseguia criar um usuário novo com perfil "admin" pra
// QUALQUER empresa, escalando privilégio. A RLS de usuarios_app já deixa
// claro que só admin/analista podem enxergar a lista toda
// (usuarios_app_select) — esta função replica a mesma regra nas escritas,
// que hoje não passam por RLS nenhuma. Mesmo padrão de guarda usado em
// /administracao/pisos-antt (perfil_usuario_atual()).
async function exigirGerenciadorDeUsuarios(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin" && perfil !== "analista") {
    return "Esta ação é exclusiva do time interno (perfil administrador ou analista).";
  }
  return null;
}

// Cria o usuário em três passos:
// 1) convida por e-mail no Supabase Auth (ele recebe um link para definir a senha)
// 2) cria o registro de perfil em usuarios_app
// 3) vincula o usuário à empresa escolhida em usuarios_empresas
export async function criarUsuario(_prev: UsuarioFormState, formData: FormData): Promise<UsuarioFormState> {
  const supabaseSessao = await createClient();
  const erroPermissao = await exigirGerenciadorDeUsuarios(supabaseSessao);
  if (erroPermissao) return { erro: erroPermissao };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nome = String(formData.get("nome") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const perfil = String(formData.get("perfil") ?? "");
  const segmento = String(formData.get("segmento") ?? "") || null;
  const empresaId = String(formData.get("empresa_id") ?? "");

  if (!email || !nome || !perfil || !empresaId) {
    return { erro: "E-mail, nome, perfil e cliente são obrigatórios." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao inicializar cliente administrativo." };
  }

  // 1) Convite via Supabase Auth — envia e-mail com link para o usuário criar a senha.
  const { error: authError } = await admin.auth.admin.inviteUserByEmail(email);
  if (authError && !authError.message.toLowerCase().includes("already been registered")) {
    return { erro: `Não foi possível convidar o usuário: ${authError.message}` };
  }

  // 2) Perfil em usuarios_app (usa o cliente admin para não depender de RLS aqui,
  // já que quem está criando é um administrador agindo em nome da plataforma).
  const { error: perfilError } = await admin.from("usuarios_app").upsert(
    { email, nome, perfil, cpf, telefone, segmento, ativo: true },
    { onConflict: "email" }
  );
  if (perfilError) {
    return { erro: `Usuário convidado, mas houve erro ao salvar o perfil: ${perfilError.message}` };
  }

  // 3) Vínculo com a empresa selecionada.
  const { error: vinculoError } = await admin
    .from("usuarios_empresas")
    .upsert({ user_email: email, empresa_id: empresaId, role: perfil, ativo: true });
  if (vinculoError) {
    return { erro: `Perfil salvo, mas houve erro ao vincular ao cliente: ${vinculoError.message}` };
  }

  revalidatePath("/usuarios");
  redirect(`/usuarios/${encodeURIComponent(email)}`);
}

export async function atualizarUsuario(
  email: string,
  _prev: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const supabase = await createClient();
  const erroPermissao = await exigirGerenciadorDeUsuarios(supabase);
  if (erroPermissao) return { erro: erroPermissao };

  const nome = String(formData.get("nome") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const perfil = String(formData.get("perfil") ?? "");
  const segmento = String(formData.get("segmento") ?? "") || null;
  const ativo = formData.get("ativo") === "on";

  if (!nome || !perfil) {
    return { erro: "Nome e perfil são obrigatórios." };
  }

  const { error } = await supabase
    .from("usuarios_app")
    .update({ nome, cpf, telefone, perfil, segmento, ativo })
    .eq("email", email);

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${encodeURIComponent(email)}`);
  return { erro: undefined };
}

export async function alternarAtivoUsuario(email: string, ativo: boolean) {
  const supabase = await createClient();
  const erroPermissao = await exigirGerenciadorDeUsuarios(supabase);
  if (erroPermissao) return { erro: erroPermissao };

  await supabase.from("usuarios_app").update({ ativo }).eq("email", email);
  await supabase.from("usuarios_empresas").update({ ativo }).eq("user_email", email);
  revalidatePath("/usuarios");
  return {};
}
