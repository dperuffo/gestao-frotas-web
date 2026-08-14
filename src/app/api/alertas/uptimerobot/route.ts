import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { alertar } from "@/lib/alertas";
import { segredoConfere } from "@/lib/segredoConstante";

// Fase Observabilidade-Fase3 (14/08/2026, pedido do Daniel: "quero que caia
// no canal do Teams") — ponte entre o UptimeRobot (monitor externo batendo
// em /api/health de fora, 24/7 — ver instruções passadas ao Daniel) e o
// mesmo canal do Teams já usado pelos alertas internos (ver
// src/lib/alertas.ts). Sem isto, o UptimeRobot só avisaria por e-mail —
// funcionaria, mas em canal separado do resto dos alertas da aplicação.
//
// Protegida por segredo na própria URL (não por header — o UptimeRobot,
// como a maioria dos serviços de webhook externos "genéricos", deixa
// configurar a URL e o corpo POST, mas não headers customizados no plano
// gratuito) — mesmo espírito do CRON_SECRET usado em /api/cron/*, só que
// aqui o segredo vem em query string por essa limitação do lado de fora.
export const runtime = "nodejs";

type CorpoUptimeRobot = {
  monitorFriendlyName?: string;
  monitorURL?: string;
  alertType?: string; // esperado: "Down" ou "Up" — ver instrução de configuração
  alertDetails?: string;
  alertDuration?: string;
};

export async function POST(request: NextRequest) {
  const segredoRecebido = request.nextUrl.searchParams.get("segredo");
  const segredoEsperado = process.env.UPTIMEROBOT_WEBHOOK_SEGREDO;

  if (!segredoEsperado || !segredoConfere(segredoRecebido, segredoEsperado)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let corpo: CorpoUptimeRobot;
  try {
    corpo = (await request.json()) as CorpoUptimeRobot;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const monitor = corpo.monitorFriendlyName ?? "Monitor";
  const estaDown = (corpo.alertType ?? "").toLowerCase().includes("down");

  void logger.info("alertas/uptimerobot", `Alerta recebido do UptimeRobot: ${corpo.alertType ?? "?"}`, { corpo });

  await alertar(
    estaDown ? `${monitor} está FORA DO AR` : `${monitor} voltou ao ar`,
    corpo.alertDetails ?? "Sem detalhe adicional do UptimeRobot.",
    { monitorURL: corpo.monitorURL ?? null, alertDuration: corpo.alertDuration ?? null },
    // Dedupe por monitor+tipo — evita duplicar se o UptimeRobot reenviar o
    // mesmo alerta (acontece com alguns provedores em caso de timeout na
    // resposta do nosso lado).
    { dedupeChave: `uptimerobot:${monitor}:${corpo.alertType ?? "?"}`, dedupeJanelaMs: 60_000 }
  );

  return NextResponse.json({ ok: true });
}
