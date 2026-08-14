import "server-only";
import { logger } from "@/lib/logger";
import { jaVisto } from "@/lib/cache";

// Fase Observabilidade-Fase2 (14/08/2026, pedido do Daniel: "a aplicação
// deve ter alertas confiáveis para monitoramento e análise") — não existia
// nenhum canal de saída pra alerta antes desta fase (achado da recon: só
// e-mail transacional do Supabase Auth, sem uso pra alerta operacional).
// Daniel forneceu uma URL de gatilho do Power Automate (não o antigo
// "Incoming Webhook" clássico do Teams — a Microsoft descontinuou esse
// conector; Power Automate é o caminho atual recomendado). Por isso o corpo
// enviado é um JSON simples e genérico (titulo/mensagem/detalhe/contexto),
// não o formato "MessageCard" do conector antigo — o Flow do Daniel é quem
// decide como usar esses campos pra montar a mensagem no canal. A URL
// funciona como uma senha (quem tem a URL consegue disparar o Flow) — por
// isso fica só em variável de ambiente (TEAMS_WEBHOOK_URL no Railway),
// nunca no código.
//
// Alerta é diferente de log: um log guarda TUDO (até o esperado), um alerta
// deveria ser raro e sempre acionável. Por isso `alertar()` só é chamado em
// pontos específicos e escolhidos a dedo (health check falhando, erro não
// tratado no cliente) — não é disparado a partir de todo `logger.error`,
// senão viraria ruído (a própria função `carregarMapaPermissoes`, por
// exemplo, já loga erro em modo fail-open o tempo todo numa instabilidade
// pontual de rede, sem que isso precise acordar ninguém).
type ContextoAlerta = Record<string, unknown>;

type OpcoesAlerta = {
  // Se informado, alertas repetidos com a MESMA `dedupeChave` dentro da
  // janela são suprimidos — evita, por exemplo, mandar 40 mensagens
  // seguidas pro Teams porque o health check falhou 40 vezes na mesma hora.
  dedupeChave?: string;
  dedupeJanelaMs?: number;
};

export async function alertar(titulo: string, detalhe: string, contexto?: ContextoAlerta, opcoes?: OpcoesAlerta): Promise<void> {
  if (opcoes?.dedupeChave) {
    const repetido = jaVisto(`alerta:${opcoes.dedupeChave}`, opcoes.dedupeJanelaMs ?? 10 * 60_000);
    if (repetido) {
      await logger.debug("alertas", "Suprimido (repetido dentro da janela de dedupe)", { titulo, dedupeChave: opcoes.dedupeChave });
      return;
    }
  }

  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) {
    // Sem a variável configurada, o alerta ainda fica registrado no log
    // estruturado (não se perde) — só não sai notificação nenhuma.
    await logger.warn("alertas", "TEAMS_WEBHOOK_URL não configurada — alerta só registrado no log", { titulo, detalhe, contexto });
    return;
  }

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: `🚨 FNI — ${titulo}`,
        mensagem: detalhe,
        contexto: contexto ?? null,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!resposta.ok) {
      await logger.warn("alertas", "Power Automate recusou o alerta", { status: resposta.status, titulo });
    }
  } catch (erro) {
    // Falha ao alertar não pode derrubar o fluxo que chamou — só loga.
    await logger.error("alertas", "Falha ao enviar alerta pro Power Automate", erro, { titulo });
  }
}
