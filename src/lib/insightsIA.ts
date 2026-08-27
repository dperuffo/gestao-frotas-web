import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// Fase IA-e-Automacao (27/08/2026, pedido do Daniel: "implementar o quinto e
// ultimo item das acoes de melhorias mapeadas - IA e Automação... abranger,
// ao máximo, insights com dados e informações das milhares de operações já
// realizadas... que agregam alto valor ao negócio e se diferencia das
// outras plataformas de TMS") — "Assistente FNI proativo" do roadmap.
//
// Arquitetura (decisão confirmada com o Daniel via pergunta explícita):
// 1. coletar_sinais_insights_ia (SQL puro, sem IA) varre ~10 sinais reais
//    por empresa e devolve candidatos com o dado bruto já calculado.
// 2. Só se houver candidato, 1 chamada ao Claude por empresa/dia PRIORIZA
//    (nem todo sinal vira insight — o valor está em separar o que realmente
//    importa) e REDIGE em português — mas nunca inventa o número: o modelo
//    só pode escolher entre os candidatos recebidos (validado abaixo) e
//    reaproveitar os valores que já vieram do SQL.
// 3. Resultado persistido via upsert_insight_ia (RPC), sticky em
//    "dispensado" — ver comentário na migration.
// Chamado 1x/dia por /api/cron/gerar-insights-ia — nunca a partir de uma
// visita de usuário à tela (custo previsível, zero custo por page load).

const MODELO = "claude-sonnet-5";

// Nunca mostra mais que isso por empresa por dia — mesmo se o SQL devolver
// dezenas de candidatos (já limitado a 8 por categoria), o valor de um
// insight "proativo" está em ser raro e acionável, não em listar tudo.
const MAX_INSIGHTS_POR_EMPRESA = 8;

type CandidatoSinal = {
  categoria: string;
  chave: string;
  titulo_sugerido: string;
  resumo: string;
  valor_impacto: number | null;
  severidade: string;
  dados: unknown;
};

type InsightSelecionado = {
  categoria: string;
  chave: string;
  titulo: string;
  descricao: string;
  recomendacao: string;
  severidade: "baixa" | "media" | "alta" | "critica";
};

const SYSTEM_PROMPT = `Você ajuda a priorizar e redigir os "Insights Proativos de IA" da plataforma
Fleet Network Intelligence (FNI), um TMS para gestão de frota. Você recebe uma lista de
CANDIDATOS a insight — cada um já é um sinal estatístico real, calculado por SQL direto no
banco de dados da operação do cliente (nenhum dado foi inventado, os números já vêm prontos).

Sua tarefa tem 2 partes:

1. PRIORIZAR: escolha, entre os candidatos recebidos, até ${MAX_INSIGHTS_POR_EMPRESA} que
   representem o MAIOR valor de negócio pra esse cliente agora — combine impacto financeiro
   (valor_impacto), severidade e o quão acionável é a recomendação. Ignore os candidatos
   fracos ou redundantes (ex.: 2 veículos com o mesmo problema podem virar 1 insight só,
   citando os dois, se fizer mais sentido). Nem todo candidato precisa virar insight — se só
   1 ou 2 valerem a pena, devolva só esses.
2. REDIGIR: para cada insight escolhido, escreva um título curto (que caiba num card),
   uma descrição em 1-2 frases (linguagem natural, direta, sem jargão de SQL) e uma
   recomendação prática de ação (o que o gestor deveria fazer a respeito). Use os números que
   já vieram no candidato — não invente nenhum dado novo, não calcule nada por conta própria.

Regras rígidas:
- Só pode devolver insights cuja "categoria"+"chave" estejam EXATAMENTE entre os candidatos
  recebidos — nunca invente uma categoria, chave ou veículo/posto/motorista que não veio na
  lista.
- Responda em português do Brasil.
- O que diferencia esse produto de um TMS comum é justamente cruzar várias frentes (combustível,
  manutenção, pneus, sinistros, multas, aprovações, seguro, motoristas) — ao escolher entre
  candidatos, prefira dar variedade de categoria quando o impacto for parecido, em vez de
  devolver 8 insights todos da mesma categoria.
- Responda APENAS com um array JSON, sem nenhum texto antes ou depois, no formato:
[{"categoria":"...","chave":"...","titulo":"...","descricao":"...","recomendacao":"...","severidade":"baixa|media|alta|critica"}]
Se nenhum candidato valer a pena virar insight, responda com um array vazio: []`;

function clienteAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada — necessária para gerar Insights Proativos de IA.");
  }
  return new Anthropic({ apiKey });
}

function extrairJsonArray(texto: string): unknown {
  const inicio = texto.indexOf("[");
  const fim = texto.lastIndexOf("]");
  if (inicio === -1 || fim === -1 || fim < inicio) {
    throw new Error("Resposta do modelo não continha um array JSON.");
  }
  return JSON.parse(texto.slice(inicio, fim + 1));
}

const SEVERIDADES_VALIDAS = new Set(["baixa", "media", "alta", "critica"]);

function validarSelecionados(bruto: unknown, candidatos: CandidatoSinal[]): InsightSelecionado[] {
  if (!Array.isArray(bruto)) return [];
  const chavesValidas = new Set(candidatos.map((c) => `${c.categoria}::${c.chave}`));

  const selecionados: InsightSelecionado[] = [];
  for (const item of bruto) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const categoria = typeof obj.categoria === "string" ? obj.categoria : "";
    const chave = typeof obj.chave === "string" ? obj.chave : "";
    const titulo = typeof obj.titulo === "string" ? obj.titulo.trim() : "";
    const descricao = typeof obj.descricao === "string" ? obj.descricao.trim() : "";
    const recomendacao = typeof obj.recomendacao === "string" ? obj.recomendacao.trim() : "";
    const severidade = typeof obj.severidade === "string" ? obj.severidade : "";

    // Defesa contra alucinação: só aceita insight cuja categoria+chave veio
    // de verdade do SQL (coletar_sinais_insights_ia) — o modelo não pode
    // fabricar um veículo/posto/motorista que não existe.
    if (!chavesValidas.has(`${categoria}::${chave}`)) continue;
    if (!titulo || !descricao) continue;

    selecionados.push({
      categoria,
      chave,
      titulo,
      descricao,
      recomendacao: recomendacao || "Revisar o caso e decidir a ação apropriada.",
      severidade: (SEVERIDADES_VALIDAS.has(severidade) ? severidade : "media") as InsightSelecionado["severidade"],
    });
  }
  return selecionados.slice(0, MAX_INSIGHTS_POR_EMPRESA);
}

// Achado ao rodar em produção pela 1ª vez (27/08/2026): numa empresa com 16
// candidatos (2 categorias cheias), o Claude respondeu sem nenhum array
// JSON — "Resposta do modelo não continha um array JSON" — provavelmente
// preâmbulo de texto explicando o raciocínio antes de recusar o formato,
// mais provável de acontecer justamente quando há mais candidato pra
// analisar (o caso que mais importa pra esse recurso funcionar bem em
// produção). Corrigido com 1 retentativa corretiva na mesma conversa,
// reforçando o formato — e logando os primeiros 500 caracteres da resposta
// crua se a 2ª tentativa também falhar, pra dar visibilidade real do que o
// modelo respondeu (antes só o erro de parse ficava no log, sem contexto).
const MAX_TENTATIVAS_CLAUDE = 2;

async function priorizarComClaude(candidatos: CandidatoSinal[], empresaId: string): Promise<InsightSelecionado[]> {
  const anthropic = clienteAnthropic();
  const mensagens: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Candidatos a insight desta empresa (${candidatos.length} no total):\n\n${JSON.stringify(
        candidatos.map((c) => ({
          categoria: c.categoria,
          chave: c.chave,
          titulo_sugerido: c.titulo_sugerido,
          resumo: c.resumo,
          valor_impacto: c.valor_impacto,
          severidade: c.severidade,
        }))
      )}`,
    },
  ];

  let ultimoTexto = "";
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CLAUDE; tentativa++) {
    const resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: mensagens,
    });

    const blocoTexto = resposta.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    ultimoTexto = blocoTexto?.text ?? "";

    try {
      const bruto = extrairJsonArray(ultimoTexto);
      return validarSelecionados(bruto, candidatos);
    } catch {
      if (tentativa === MAX_TENTATIVAS_CLAUDE - 1) break;
      mensagens.push({ role: "assistant", content: ultimoTexto });
      mensagens.push({
        role: "user",
        content:
          "Sua resposta anterior não veio em JSON válido. Responda de novo, agora SOMENTE com o array JSON (comece a resposta direto com '[' e termine com ']', sem nenhum texto antes, depois, ou markdown ao redor).",
      });
    }
  }

  await logger.error(
    "insightsIA",
    "Claude não devolveu JSON válido após retentativa (insights não atualizados hoje pra essa empresa)",
    new Error("Resposta sem array JSON"),
    { empresaId, textoRecebido: ultimoTexto.slice(0, 500) }
  );
  return [];
}

export type ResultadoGeracaoInsights = { empresaId: string; candidatos: number; gerados: number; erro?: string };

// Gera os insights de UMA empresa — chamado em loop pelo cron
// (/api/cron/gerar-insights-ia) usando o client admin (service_role, bypassa
// RLS de propósito: o cron roda fora do contexto de qualquer usuário
// logado, precisa varrer os dados de todas as empresas ativas).
export async function gerarInsightsEmpresa(
  empresaId: string,
  supabaseAdmin: SupabaseAdmin
): Promise<ResultadoGeracaoInsights> {
  const { data: candidatosRaw, error: erroColeta } = await supabaseAdmin.rpc("coletar_sinais_insights_ia", {
    p_empresa_id: empresaId,
  });

  if (erroColeta) {
    return { empresaId, candidatos: 0, gerados: 0, erro: `Falha ao coletar sinais: ${erroColeta.message}` };
  }

  const candidatos = (candidatosRaw ?? []) as CandidatoSinal[];
  if (candidatos.length === 0) {
    return { empresaId, candidatos: 0, gerados: 0 };
  }

  let selecionados: InsightSelecionado[];
  try {
    selecionados = await priorizarComClaude(candidatos, empresaId);
  } catch (erro) {
    await logger.error("insightsIA", "Falha ao priorizar/redigir com Claude (ignorado, insights não atualizados hoje)", erro, {
      empresaId,
    });
    return {
      empresaId,
      candidatos: candidatos.length,
      gerados: 0,
      erro: erro instanceof Error ? erro.message : "Erro desconhecido ao chamar o Claude.",
    };
  }

  let gerados = 0;
  for (const insight of selecionados) {
    const candidato = candidatos.find((c) => c.categoria === insight.categoria && c.chave === insight.chave);
    const { error: erroUpsert } = await supabaseAdmin.rpc("upsert_insight_ia", {
      p_empresa_id: empresaId,
      p_categoria: insight.categoria,
      p_chave: insight.chave,
      p_titulo: insight.titulo,
      p_descricao: insight.descricao,
      p_recomendacao: insight.recomendacao,
      p_severidade: insight.severidade,
      p_valor_impacto: candidato?.valor_impacto ?? null,
      p_dados: (candidato?.dados ?? null) as never,
    });
    if (erroUpsert) {
      await logger.error("insightsIA", "Falha ao gravar insight (ignorado, segue pros próximos)", erroUpsert, {
        empresaId,
        categoria: insight.categoria,
        chave: insight.chave,
      });
      continue;
    }
    gerados++;
  }

  return { empresaId, candidatos: candidatos.length, gerados };
}
