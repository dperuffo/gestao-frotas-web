"use server";

import { createClient } from "@/lib/supabase/server";
import { perguntarAssistente, type MensagemChat, type ConsultaExecutada } from "@/lib/assistenteIA";

export type RespostaChatAssistente = { resposta: string; consultas: ConsultaExecutada[] } | { erro: string };

// Server action chamada pelo componente de chat a cada pergunta enviada.
// Recebe o histórico (mantido em memória no cliente, sem persistência no
// banco por enquanto) para dar continuidade à conversa, mas só envia as
// últimas mensagens ao modelo para não deixar o contexto enorme.
export async function perguntarAssistenteAcao(
  pergunta: string,
  historico: MensagemChat[]
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
    const { resposta, consultas } = await perguntarAssistente(perguntaLimpa, historico.slice(-12), supabase);
    return { resposta, consultas };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Erro inesperado ao consultar o assistente.";
    return { erro: mensagem };
  }
}
