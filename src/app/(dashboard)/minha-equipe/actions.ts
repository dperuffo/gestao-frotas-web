"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarLimiteUsuarios, mensagemLimiteUsuariosExcedido } from "@/lib/limitePlano";

export type ConvidarColegaState = { erro?: string; sucesso?: string } | undefined;

// Fase Convite-Self-Service (26/07/2026, pedido do Daniel: "criar um
// convite self-service, cliente convida dentro do próprio plano de
// usuários, respeitando max_usuarios"). Diferente de /usuarios (exclusivo
// do time interno FNI, perfil admin/analista, convida pra QUALQUER
// empresa e QUALQUER perfil), esta tela é do PRÓPRIO cliente/posto:
// gestor_frota ou posto convida um colega só pra própria empresa, sempre
// como perfil "colaborador" (decisão confirmada com o Daniel via
// AskUserQuestion — ver comentário na migração usuarios_app_perfil_
// colaborador pro raciocínio completo de por que não reaproveitar
// 'analista'/'gestor_frota'/'posto').
async function exigirDonoDeEquipe(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "gestor_frota" && perfil !== "posto") {
    return "Convidar colegas é uma ação do gestor da frota (ou do posto).";
  }
  return null;
}

export async function convidarColega(
  empresaId: string,
  _prev: ConvidarColegaState,
  formData: FormData
): Promise<ConvidarColegaState> {
  const supabaseSessao = await createClient();
  const erroPermissao = await exigirDonoDeEquipe(supabaseSessao);
  if (erroPermissao) return { erro: erroPermissao };

  const {
    data: { user },
  } = await supabaseSessao.auth.getUser();

  // Confere que o chamador tem mesmo um vínculo DIRETO e ativo com essa
  // empresa (empresaId vem de um campo oculto do formulário — não confiar
  // cegamente nele; RLS de usuarios_empresas também bloquearia, mas essa
  // checagem explícita evita depender só disso, mesmo espírito da Fase de
  // segurança de /usuarios).
  const { data: vinculo } = await supabaseSessao
    .from("usuarios_empresas")
    .select("empresa_id")
    .eq("user_email", user?.email ?? "")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .maybeSingle();
  if (!vinculo) return { erro: "Empresa inválida para o seu usuário." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nome = String(formData.get("nome") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;

  if (!email || !nome) {
    return { erro: "E-mail e nome são obrigatórios." };
  }

  const limite = await verificarLimiteUsuarios(supabaseSessao, empresaId);
  if (!limite.ok) {
    return { erro: mensagemLimiteUsuariosExcedido(limite) };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao inicializar cliente administrativo." };
  }

  // Se o e-mail já tem conta/perfil no sistema (ex.: já é colaborador de
  // outra empresa, ou é o próprio time FNI), não mexe no perfil dele — só
  // adiciona o vínculo com esta empresa. Perfil "colaborador" só é
  // atribuído a quem está entrando pela primeira vez.
  const { data: usuarioExistente } = await admin
    .from("usuarios_app")
    .select("email, perfil")
    .eq("email", email)
    .maybeSingle();

  if (!usuarioExistente) {
    const { data: empresaInfo } = await admin.from("empresas").select("segmento").eq("id", empresaId).maybeSingle();

    const { error: authError } = await admin.auth.admin.inviteUserByEmail(email);
    if (authError && !authError.message.toLowerCase().includes("already been registered")) {
      return { erro: `Não foi possível convidar o usuário: ${authError.message}` };
    }

    const { error: perfilError } = await admin.from("usuarios_app").insert({
      email,
      nome,
      cpf,
      telefone,
      perfil: "colaborador",
      segmento: empresaInfo?.segmento ?? null,
      ativo: true,
    });
    if (perfilError) {
      return { erro: `Convite enviado, mas houve erro ao salvar o perfil: ${perfilError.message}` };
    }
  }

  const { error: vinculoError } = await admin
    .from("usuarios_empresas")
    .upsert({ user_email: email, empresa_id: empresaId, role: usuarioExistente?.perfil ?? "colaborador", ativo: true });
  if (vinculoError) {
    return { erro: `Perfil salvo, mas houve erro ao vincular à empresa: ${vinculoError.message}` };
  }

  revalidatePath("/minha-equipe");
  return {
    sucesso: usuarioExistente
      ? `${email} já tinha conta no sistema e foi vinculado à sua equipe.`
      : `Convite enviado para ${email} — ele(a) recebe um e-mail para criar a própria senha.`,
  };
}

export async function alternarAtivoColega(empresaId: string, email: string, ativo: boolean) {
  const supabase = await createClient();
  const erroPermissao = await exigirDonoDeEquipe(supabase);
  if (erroPermissao) return { erro: erroPermissao };

  // Só mexe em quem é "colaborador" — nunca em admin/analista/gestor_frota/
  // posto por esta tela, mesmo que por algum motivo apareçam vinculados
  // (ex.: o próprio dono, listado só pra contexto).
  const { data: alvo } = await supabase.from("usuarios_app").select("perfil").eq("email", email).maybeSingle();
  if (alvo?.perfil !== "colaborador") {
    return { erro: "Só é possível ativar/inativar colaboradores por aqui." };
  }

  await supabase.from("usuarios_empresas").update({ ativo }).eq("user_email", email).eq("empresa_id", empresaId);
  revalidatePath("/minha-equipe");
  return {};
}
