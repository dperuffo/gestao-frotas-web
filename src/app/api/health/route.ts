import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger, obterRequestIdAtual } from "@/lib/logger";

// Fase Observabilidade-Fundacao (14/08/2026, pedido do Daniel: "todo serviço
// deve ter health check com status detalhado") — endpoint usado pelo Railway
// (ver railway.json → deploy.healthcheckPath) pra decidir se um deploy novo
// está saudável antes de trocar o tráfego pra ele; se este endpoint não
// responder 200 dentro do timeout configurado, o Railway mantém o deploy
// anterior no ar (é assim que vira "rollback automático" sem precisar
// escrever lógica de rollback nenhuma — o Railway nunca promove a versão
// nova). Usa `createAdminClient()` (chave de service role) em vez do cliente
// de cookie porque este endpoint É chamado sem sessão de usuário nenhuma.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResultadoChecagem = {
  status: "ok" | "erro";
  latenciaMs: number;
  detalhe?: string;
};

async function checarBancoDeDados(): Promise<ResultadoChecagem> {
  const inicio = Date.now();
  try {
    const supabase = createAdminClient();
    // Consulta mínima, só pra confirmar que o Postgres/PostgREST responde —
    // `head: true` não traz linha nenhuma, só o status HTTP.
    const { error } = await supabase.from("empresas").select("id", { head: true, count: "exact" });
    const latenciaMs = Date.now() - inicio;
    if (error) {
      return { status: "erro", latenciaMs, detalhe: error.message };
    }
    return { status: "ok", latenciaMs };
  } catch (erro) {
    return {
      status: "erro",
      latenciaMs: Date.now() - inicio,
      detalhe: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

export async function GET() {
  const requestId = await obterRequestIdAtual();
  const inicio = Date.now();

  const banco = await checarBancoDeDados();
  const saudavel = banco.status === "ok";

  const corpo = {
    status: saudavel ? "ok" : "erro",
    timestamp: new Date().toISOString(),
    requestId,
    duracaoMs: Date.now() - inicio,
    checks: {
      database: banco,
    },
    versao: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  };

  if (!saudavel) {
    logger.error("api/health", "Health check falhou", undefined, { checks: corpo.checks });
  }

  // 503 quando não saudável — é esse código que o healthcheckPath do
  // Railway trata como "deploy não está pronto/está com problema".
  return NextResponse.json(corpo, { status: saudavel ? 200 : 503 });
}
