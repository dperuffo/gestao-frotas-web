"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { validarRegraConsumo } from "@/lib/regraConsumo";
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

  try {
    const { empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaId);
    const { resposta, consultas, blocos, propostas } = await perguntarAssistente(perguntaLimpa, historico.slice(-12), supabase, {
      empresaId: empresaSelecionada,
      empresaNome: nomeEmpresaSelecionada ?? null,
    });
    return { resposta, consultas, blocos, propostas };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro inesperado ao consultar o assistente.";
    return { erro: mensagem };
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
