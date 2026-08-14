import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { alertar } from "@/lib/alertas";

// Fase Observabilidade-Fundacao (14/08/2026) — erro que acontece só na
// renderização do navegador (ex.: um `error.tsx` disparado) até agora só
// aparecia no console do próprio usuário, que o Daniel nunca vê. Esta rota
// recebe esse erro e grava no log estruturado do servidor (visível no painel
// de logs do Railway), com o mesmo Request ID que apareceu pro usuário —
// junta os dois lados (cliente + servidor) da mesma requisição.
export const runtime = "nodejs";

type CorpoLogCliente = {
  mensagem?: string;
  stack?: string;
  digest?: string;
  pathname?: string;
  contexto?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  let corpo: CorpoLogCliente;
  try {
    corpo = (await request.json()) as CorpoLogCliente;
  } catch {
    // Corpo malformado não derruba nada — só não tem o que logar de útil.
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const mensagem = corpo.mensagem ?? "Erro não descrito no cliente";
  await logger.error("cliente/error-boundary", mensagem, undefined, {
    stack: corpo.stack ?? null,
    digest: corpo.digest ?? null,
    pathname: corpo.pathname ?? null,
    ...(corpo.contexto ?? {}),
  });

  // Fase Observabilidade-Fase2 — dedupe por mensagem+tela: se o mesmo bug
  // estourar pra vários usuários na mesma tela ao mesmo tempo (o caso mais
  // comum de erro em produção), manda um alerta só, não um por usuário.
  await alertar("Erro na tela (cliente)", mensagem, { pathname: corpo.pathname ?? null, digest: corpo.digest ?? null }, {
    dedupeChave: `cliente:${corpo.pathname ?? "?"}:${mensagem}`,
    dedupeJanelaMs: 15 * 60_000,
  });

  return NextResponse.json({ ok: true });
}
