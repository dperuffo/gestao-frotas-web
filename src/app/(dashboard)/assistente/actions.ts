"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { validarRegraConsumo } from "@/lib/regraConsumo";
import { prepararAssistente, registrarConsumoAssistente, mensagemErroChaveCliente, type OrigemChave } from "@/lib/assistenteConsumo";
import { perguntarAssistente, type MensagemChat, type ConsultaExecutada, type BlocoVisual, type PropostaAcao } from "@/lib/assistenteIA";

export type RespostaChatAssistente = { resposta: string; consultas: ConsultaExecutada[]; blocos: BlocoVisual[]; propostas: PropostaAcao[] } | { erro: string };

// Server action chamada pelo componente de chat a cada pergunta enviada.
// Recebe o histórico (mantido em memória no cliente, sem persistência no
// banco por enquanto) para dar continuidade à conversa, mas só envia as
// últimas mensagens ao modelo para não deixar o contexto enorme.
export async function perguntarAssistenteAcao(
  pergunta: string,
  historico: MensagemChat[],
  empresaId?: string
): Promise<RespostaChatAssistente> {
  const perguntaLimpa = pergunta.trim();
  if (!perguntaLimpa) return { erro: "Digite uma pergunta." };
  if (perguntaLimpa.length > 2000) return { erro: "Pergunta muito longa (máximo 2000 caracteres)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada, faça login novamente." };

  const medidor = { entrada: 0, saida: 0 };
  let empresaConsumo: string | null = null;
  let origem: OrigemChave = "interno";
  try {
    const { empresaSelecionada, nomeEmpresaSelecionada, perfil } = await resolverEmpresaAtual(supabase, empresaId);
    // O consumo de IA é atribuído a UM cliente. Quem tem várias empresas precisa escolher; só o
    // admin da FNI (uso interno) pode perguntar sem cliente.
    if (!empresaSelecionada && perfil !== "admin") {
      return { erro: "Selecione um cliente na barra acima do chat para usar o Assistente." };
    }
    empresaConsumo = empresaSelecionada;
    const preparo = await prepararAssistente(supabase, empresaSelecionada);
    if (!preparo.ok) return { erro: preparo.mensagem };
    origem = preparo.origem;

    const { resposta, consultas, blocos, propostas } = await perguntarAssistente(perguntaLimpa, historico.slice(-12), supabase, {
      empresaId: empresaSelecionada,
      empresaNome: nomeEmpresaSelecionada ?? null,
      chaveApi: preparo.chaveApi,
      medidor,
    });
    return { resposta, consultas, blocos, propostas };
  } catch (e) {
    const amigavel = origem === "cliente" ? mensagemErroChaveCliente(e) : null;
    const mensagem = amigavel ?? (e instanceof Error ? e.message : "Erro inesperado ao consultar o assistente.");
    return { erro: mensagem };
  } finally {
    await registrarConsumoAssistente(supabase, empresaConsumo, medidor, origem);
  }
}

// Confirmação de uma proposta do assistente (regra de consumo). Nada vem "pronto"
// do cliente: re-valida os campos, confere que a empresa é uma das do usuário
// (resolverEmpresaAtual + RLS da tabela) e só então grava.
export async function confirmarRegraConsumoAcao(
  proposta: Pick<PropostaAcao, "empresaId" | "marcaContem" | "placa" | "consumoMinimo" | "consumoMaximo" | "percentualTanqueMinimo">
): Promise<{ ok: true; mensagem: string } | { ok: false; erro: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada, faça login novamente." };

  const { empresaSelecionada } = await resolverEmpresaAtual(supabase, proposta.empresaId);
  if (!empresaSelecionada || empresaSelecionada !== proposta.empresaId) {
    return { ok: false, erro: "Você não tem acesso a essa empresa." };
  }
  const v = validarRegraConsumo(proposta);
  if (typeof v === "string") return { ok: false, erro: v };

  const { error } = await supabase.from("parametros_consumo_veiculo").insert({
    empresa_id: empresaSelecionada,
    marca_contem: v.marcaContem,
    placa: v.placa,
    consumo_minimo: v.consumoMinimo,
    consumo_maximo: v.consumoMaximo,
    percentual_tanque_minimo: v.percentualTanqueMinimo,
    observacao: "Criada pelo Assistente FNI",
    criado_por: user.email ?? null,
  });
  if (error) return { ok: false, erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/parametros-uso");
  return { ok: true, mensagem: "Regra criada. Você pode ajustá-la em Parâmetros de uso → Consumo (km/l)." };
}

// --- Histórico de conversas -------------------------------------------------
// Cada usuário só enxerga as próprias conversas (RLS por e-mail). Propostas de
// ação (confirmações) NÃO são salvas: ao reabrir uma conversa antiga, ninguém
// confirma por engano uma regra proposta dias atrás.
export type MensagemSalva = {
  role: "user" | "assistant";
  content: string;
  consultas?: ConsultaExecutada[];
  blocos?: BlocoVisual[];
  erro?: boolean;
};
export type ResumoConversa = { id: string; titulo: string; atualizadoEm: string };

function tituloDaConversa(mensagens: MensagemSalva[]): string {
  const primeira = mensagens.find((m) => m.role === "user")?.content.trim() ?? "Nova conversa";
  return primeira.length > 70 ? `${primeira.slice(0, 67)}…` : primeira;
}

export async function listarConversasAcao(): Promise<ResumoConversa[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assistente_conversas")
    .select("id, titulo, atualizado_em")
    .order("atualizado_em", { ascending: false })
    .limit(30);
  return (data ?? []).map((c) => ({ id: c.id, titulo: c.titulo, atualizadoEm: c.atualizado_em }));
}

export async function abrirConversaAcao(id: string): Promise<{ mensagens: MensagemSalva[] } | { erro: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("assistente_conversas").select("mensagens").eq("id", id).maybeSingle();
  if (error || !data) return { erro: "Conversa não encontrada." };
  return { mensagens: (Array.isArray(data.mensagens) ? data.mensagens : []) as unknown as MensagemSalva[] };
}

export async function salvarConversaAcao(params: {
  id?: string | null;
  empresaId?: string | null;
  mensagens: MensagemSalva[];
}): Promise<{ id: string } | { erro: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada." };
  const mensagens = params.mensagens.slice(-60).map((m) => ({
    role: m.role,
    content: String(m.content ?? "").slice(0, 8000),
    consultas: m.consultas?.slice(0, 10),
    blocos: m.blocos?.slice(0, 6),
    erro: m.erro,
  }));
  if (mensagens.length === 0) return { erro: "Nada para salvar." };
  const campos = {
    titulo: tituloDaConversa(mensagens),
    mensagens: mensagens as unknown as Json,
    empresa_id: params.empresaId ?? null,
    atualizado_em: new Date().toISOString(),
  };
  if (params.id) {
    const { error } = await supabase.from("assistente_conversas").update(campos).eq("id", params.id);
    if (error) return { erro: error.message };
    return { id: params.id };
  }
  const { data, error } = await supabase
    .from("assistente_conversas")
    .insert({ ...campos, usuario_email: user.email })
    .select("id")
    .single();
  if (error || !data) return { erro: error?.message ?? "Não foi possível salvar." };
  return { id: data.id };
}

export async function excluirConversaAcao(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("assistente_conversas").delete().eq("id", id);
}

// --- Chave própria do cliente ---------------------------------------------------
// A chave é validada na Anthropic antes de salvar e fica no Vault (criptografada);
// nunca volta ao navegador (só os 4 últimos caracteres). Quem pode: admin, gestor de frota, posto.
export async function salvarChaveAssistenteAcao(
  empresaId: string,
  chave: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const limpa = chave.trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(limpa)) {
    return { ok: false, erro: "Chave inválida. Ela começa com “sk-ant-” (copie inteira do console da Anthropic)." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada, faça login novamente." };

  // Testa a chave (listar modelos não consome tokens).
  try {
    await new Anthropic({ apiKey: limpa }).models.list({ limit: 1 });
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    return {
      ok: false,
      erro:
        status === 401 || status === 403
          ? "A Anthropic recusou essa chave. Confira se ela está ativa e copiada por completo."
          : "Não foi possível validar a chave agora. Tente novamente em instantes.",
    };
  }

  const { error } = await supabase.rpc("definir_chave_assistente", { p_empresa_id: empresaId, p_chave: limpa });
  if (error) return { ok: false, erro: error.message.includes("permiss") ? "Seu perfil não pode cadastrar a chave da empresa." : "Não foi possível salvar a chave." };
  revalidatePath("/assistente");
  return { ok: true };
}

export async function removerChaveAssistenteAcao(empresaId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remover_chave_assistente", { p_empresa_id: empresaId });
  if (error) return { ok: false, erro: "Não foi possível remover a chave." };
  revalidatePath("/assistente");
  return { ok: true };
}
