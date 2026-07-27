"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarLimiteUsuarios, mensagemLimiteUsuariosExcedido } from "@/lib/limitePlano";
import { PERFIL_LABEL, type Perfil } from "@/lib/constants";
import { cpfDuplicadoUsuarioApp } from "@/lib/duplicidade";

export type ConvidarColegaState = { erro?: string; sucesso?: string } | undefined;

// Fase tratamento-cnpj-cpf (27/07/2026) — aviso NÃO bloqueante, chamado do
// formulário de convite (onBlur do campo CPF), antes de enviar o convite.
// Fase editar-excluir-colega — reaproveitada também no modal de Editar;
// `excluirEmail` evita o próprio colega disparar o aviso contra si mesmo
// quando o CPF não mudou.
export async function verificarCpfDuplicadoColega(cpf: string, excluirEmail?: string) {
  const supabase = await createClient();
  return { duplicado: await cpfDuplicadoUsuarioApp(supabase, cpf, excluirEmail) };
}

// Fase Convite-Self-Service — a leitura direta de usuarios_app pra checar o
// perfil de OUTRO usuário (ex.: "esse e-mail já é colaborador?") não
// funciona com o client de sessão: a RLS de usuarios_app só libera
// admin/analista ou a própria linha (email = auth.jwt()->>'email'). A RPC
// equipe_da_empresa (SECURITY DEFINER, criada junto com esta feature) é o
// jeito correto de ler nome/perfil de colegas da MESMA empresa — usada em
// toda ação abaixo que precisa saber o perfil de outra pessoa.
async function buscarMembro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  email: string
) {
  const { data: equipe } = await supabase.rpc("equipe_da_empresa", { p_empresa_id: empresaId });
  return (equipe ?? []).find((m) => m.email === email) ?? null;
}

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

// Fase editar-excluir-colega (27/07/2026, pedido do Daniel: "ter a
// possibilidade de editar e excluir um usuario" em Minha Equipe). Busca
// nome/cpf/telefone SÓ na hora de abrir o modal de Editar (RPC dedicada
// dados_colega_para_edicao — equipe_da_empresa, usada na listagem, não
// expõe CPF/telefone de propósito, ver comentário na migração).
export type DadosColegaParaEdicao =
  | { ok: true; nome: string; cpf: string; telefone: string }
  | { ok: false; erro: string };

export async function buscarDadosColegaParaEdicaoAcao(
  empresaId: string,
  email: string
): Promise<DadosColegaParaEdicao> {
  const supabase = await createClient();
  const erroPermissao = await exigirDonoDeEquipe(supabase);
  if (erroPermissao) return { ok: false, erro: erroPermissao };

  const { data, error } = await supabase.rpc("dados_colega_para_edicao", {
    p_empresa_id: empresaId,
    p_email: email,
  });
  if (error) return { ok: false, erro: `Não foi possível carregar os dados: ${error.message}` };
  const dados = data?.[0];
  if (!dados) return { ok: false, erro: "Colega não encontrado nesta equipe." };
  return { ok: true, nome: dados.nome ?? "", cpf: dados.cpf ?? "", telefone: dados.telefone ?? "" };
}

export type EditarColegaState = { erro?: string; sucesso?: string } | undefined;

export async function editarColegaAcao(
  empresaId: string,
  email: string,
  _prev: EditarColegaState,
  formData: FormData
): Promise<EditarColegaState> {
  const supabase = await createClient();
  const erroPermissao = await exigirDonoDeEquipe(supabase);
  if (erroPermissao) return { erro: erroPermissao };

  // Só mexe em "colaborador" — mesma restrição das outras ações desta
  // tela (promover/ativar-inativar).
  const alvo = await buscarMembro(supabase, empresaId, email);
  if (alvo?.perfil !== "colaborador") {
    return { erro: "Só é possível editar colaboradores da sua equipe." };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  if (!nome) return { erro: "Nome é obrigatório." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao inicializar cliente administrativo." };
  }

  // Atualiza usuarios_app (linha global, por isso precisa do client admin —
  // a RLS de usuarios_app só libera admin/analista ou a própria linha, ver
  // comentário de buscarMembro acima).
  const { error } = await admin.from("usuarios_app").update({ nome, cpf, telefone }).eq("email", email);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };

  revalidatePath("/minha-equipe");
  return { sucesso: `Dados de ${email} atualizados.` };
}

// Remove o VÍNCULO com esta empresa (linha de usuarios_empresas) — diferente
// de "Inativar" (alternarAtivoColega, acima), que só marca ativo=false e
// mantém o histórico. "Excluir" tira de vez da equipe (o colega some da
// lista e libera a vaga do plano); mas nunca apaga o perfil global em
// usuarios_app nem a conta de autenticação — se essa pessoa também estiver
// vinculada a OUTRA empresa (raro, mas possível), o acesso dela lá continua
// intacto; e caso volte a ser convidada aqui, entra como um vínculo novo.
export async function removerColegaAcao(empresaId: string, email: string): Promise<EditarColegaState> {
  const supabase = await createClient();
  const erroPermissao = await exigirDonoDeEquipe(supabase);
  if (erroPermissao) return { erro: erroPermissao };

  const alvo = await buscarMembro(supabase, empresaId, email);
  if (alvo?.perfil !== "colaborador") {
    return { erro: "Só é possível excluir colaboradores da sua equipe." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao inicializar cliente administrativo." };
  }

  const { error } = await admin
    .from("usuarios_empresas")
    .delete()
    .eq("user_email", email)
    .eq("empresa_id", empresaId);
  if (error) return { erro: `Não foi possível excluir: ${error.message}` };

  revalidatePath("/minha-equipe");
  return { sucesso: `${email} removido(a) da equipe.` };
}

export async function alternarAtivoColega(empresaId: string, email: string, ativo: boolean) {
  const supabase = await createClient();
  const erroPermissao = await exigirDonoDeEquipe(supabase);
  if (erroPermissao) return { erro: erroPermissao };

  // Só mexe em quem é "colaborador" — nunca em admin/analista/gestor_frota/
  // posto por esta tela, mesmo que por algum motivo apareçam vinculados
  // (ex.: o próprio dono, listado só pra contexto).
  const alvo = await buscarMembro(supabase, empresaId, email);
  if (alvo?.perfil !== "colaborador") {
    return { erro: "Só é possível ativar/inativar colaboradores por aqui." };
  }

  await supabase.from("usuarios_empresas").update({ ativo }).eq("user_email", email).eq("empresa_id", empresaId);
  revalidatePath("/minha-equipe");
  return {};
}

export type PromoverColegaState = { erro?: string; sucesso?: string } | undefined;

// Fase Convite-Self-Service (26/07/2026, pedido do Daniel: "qual seria sua
// proposta... transferência de gestão interna?") — decisão confirmada via
// AskUserQuestion: um dono só pode promover colegas e rebaixar A SI MESMO;
// rebaixar OUTRO dono fica exclusivo do time interno (/usuarios), pra uma
// disputa de governança interna da empresa cliente não virar um golpe de
// acesso dentro do sistema. "Transferência" completa = promover o sucessor
// (esta função) + o dono antigo se auto-rebaixar depois
// (autoRebaixarParaColaborador, abaixo) — nunca um passo único, pra nunca
// existir um instante em que a empresa fica sem nenhum dono.
export async function promoverColega(empresaId: string, email: string): Promise<PromoverColegaState> {
  const supabase = await createClient();
  const erroPermissao = await exigirDonoDeEquipe(supabase);
  if (erroPermissao) return { erro: erroPermissao };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: vinculo } = await supabase
    .from("usuarios_empresas")
    .select("empresa_id")
    .eq("user_email", user?.email ?? "")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .maybeSingle();
  if (!vinculo) return { erro: "Empresa inválida para o seu usuário." };

  const alvo = await buscarMembro(supabase, empresaId, email);
  if (alvo?.perfil !== "colaborador") {
    return { erro: "Só é possível promover colaboradores da sua equipe." };
  }

  const { data: empresaInfo } = await supabase.from("empresas").select("segmento").eq("id", empresaId).maybeSingle();
  const novoPerfil: Perfil = empresaInfo?.segmento === "Revenda" ? "posto" : "gestor_frota";

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao inicializar cliente administrativo." };
  }

  // usuarios_app.perfil é um campo GLOBAL (não por empresa) — se este
  // e-mail tiver vínculo com mais de uma empresa (raro pra um colaborador
  // recém-convidado, mas possível), a promoção muda o perfil dele em
  // TODAS. Aceitável pro caso comum (colaborador vinculado só a esta
  // empresa); não há hoje um modelo de perfil por empresa no sistema.
  const { error: erroPerfil } = await admin.from("usuarios_app").update({ perfil: novoPerfil }).eq("email", email);
  if (erroPerfil) return { erro: `Não foi possível promover: ${erroPerfil.message}` };

  await admin.from("usuarios_empresas").update({ role: novoPerfil }).eq("user_email", email).eq("empresa_id", empresaId);

  revalidatePath("/minha-equipe");
  return { sucesso: `${email} agora é ${PERFIL_LABEL[novoPerfil]}.` };
}

// Fase Convite-Self-Service — o dono se auto-rebaixa a colaborador (nunca
// mexe em outra pessoa). Bloqueado se ele for o ÚNICO dono ativo da
// empresa (a empresa nunca pode ficar sem ninguém no comando) ou se seu
// e-mail estiver vinculado a mais de uma empresa (perfil é global — mudar
// aqui mudaria o acesso dele nas outras também; esse caso mais raro segue
// pro time interno).
export async function autoRebaixarParaColaborador(empresaId: string): Promise<PromoverColegaState> {
  const supabase = await createClient();
  const erroPermissao = await exigirDonoDeEquipe(supabase);
  if (erroPermissao) return { erro: erroPermissao };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meuEmail = user?.email ?? "";

  const { count: qtdEmpresas } = await supabase
    .from("usuarios_empresas")
    .select("empresa_id", { count: "exact", head: true })
    .eq("user_email", meuEmail)
    .eq("ativo", true);
  if ((qtdEmpresas ?? 0) > 1) {
    return {
      erro: "Seu usuário está vinculado a mais de uma empresa — deixar de ser gestor mudaria seu acesso em todas elas. Peça ajuda ao suporte para esse caso.",
    };
  }

  const { data: equipe } = await supabase.rpc("equipe_da_empresa", { p_empresa_id: empresaId });
  const membros = equipe ?? [];
  const outrosDonosAtivos = membros.filter(
    (m) => m.email !== meuEmail && m.ativo && (m.perfil === "gestor_frota" || m.perfil === "posto")
  );
  if (outrosDonosAtivos.length === 0) {
    return {
      erro: "Você é o único dono desta empresa — promova outro colega antes de deixar de ser gestor, para a empresa não ficar sem ninguém no comando.",
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao inicializar cliente administrativo." };
  }

  const { error } = await admin.from("usuarios_app").update({ perfil: "colaborador" }).eq("email", meuEmail);
  if (error) return { erro: `Não foi possível concluir: ${error.message}` };
  await admin.from("usuarios_empresas").update({ role: "colaborador" }).eq("user_email", meuEmail).eq("empresa_id", empresaId);

  revalidatePath("/minha-equipe");
  return { sucesso: "Você agora é colaborador nesta empresa." };
}
