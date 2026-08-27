import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarInsightsEmpresa } from "@/lib/insightsIA";
import { segredoConfere } from "@/lib/segredoConstante";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";

// Fase IA-e-Automacao (27/08/2026) — job diário dos "Insights Proativos de
// IA" (Assistente FNI proativo). Mesmo padrão de autenticação/agendamento
// de /api/cron/sync-profrotas e /api/cron/atualizar-precos-anp — configure
// o agendador (Vercel Cron, cron externo, pg_cron do Supabase) pra chamar
// esta rota 1x/dia com `Authorization: Bearer <CRON_SECRET>`.
//
// Roda em runtime Node: chamadas de rede pro Anthropic podem ser lentas, e
// processamos as empresas em sequência de propósito (não em paralelo) —
// evita estourar rate limit da API do Claude quando a base de clientes
// crescer.
export const runtime = "nodejs";
export const maxDuration = 300;

async function executar(request: Request) {
  const segredoEsperado = process.env.CRON_SECRET;
  if (!segredoEsperado) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  const autorizacao = request.headers.get("authorization");
  if (!segredoConfere(autorizacao, `Bearer ${segredoEsperado}`)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const limite = verificarLimite(`cron-insights-ia:${ipDaRequisicao(request)}`, 20, 5 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const supabase = createAdminClient();
  const { data: empresas, error } = await supabase.from("empresas").select("id, nome").eq("ativo", true);

  if (error) {
    return NextResponse.json({ erro: `Falha ao listar empresas: ${error.message}` }, { status: 500 });
  }

  const resultados = [];
  for (const empresa of empresas ?? []) {
    const resultado = await gerarInsightsEmpresa(empresa.id, supabase);
    resultados.push({ empresa_id: empresa.id, nome: empresa.nome, ...resultado });
  }

  return NextResponse.json({
    processadas: resultados.length,
    com_candidatos: resultados.filter((r) => r.candidatos > 0).length,
    insights_gerados_total: resultados.reduce((soma, r) => soma + r.gerados, 0),
    resultados,
  });
}

export async function GET(request: Request) {
  return executar(request);
}

export async function POST(request: Request) {
  return executar(request);
}
