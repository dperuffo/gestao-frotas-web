import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Fase P0.1 — webhook do provedor fiscal (autorização/rejeição de CT-e e
// MDF-e chegam por aqui de forma assíncrona, na P0.2+). Mesmo padrão de
// gravação bruta de stripe_events: o evento é persistido ANTES de qualquer
// processamento — se o processamento falhar, nada se perde e dá pra
// reprocessar (fiscal_webhook_eventos.processado = false).
//
// Protegido por FISCAL_WEBHOOK_SECRET (mesmo espírito do CRON_SECRET dos
// crons): o provedor real é configurado pra mandar o header
// "x-webhook-secret"; o provedor simulado usa o mesmo mecanismo nos testes.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const segredoEsperado = process.env.FISCAL_WEBHOOK_SECRET;
  if (!segredoEsperado) {
    return NextResponse.json({ erro: "FISCAL_WEBHOOK_SECRET não configurado no servidor." }, { status: 500 });
  }
  if (request.headers.get("x-webhook-secret") !== segredoEsperado) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido — esperado JSON." }, { status: 400 });
  }

  const corpo = (payload ?? {}) as Record<string, unknown>;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fiscal_webhook_eventos")
    .insert({
      provedor: typeof corpo.provedor === "string" ? corpo.provedor : "desconhecido",
      tipo_evento: typeof corpo.tipo_evento === "string" ? corpo.tipo_evento : null,
      referencia: typeof corpo.referencia === "string" ? corpo.referencia : null,
      payload: corpo as never,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ erro: `Falha ao registrar o evento: ${error.message}` }, { status: 500 });
  }

  // O processamento de verdade (atualizar status do CT-e/MDF-e) entra na
  // P0.2 — por enquanto o evento só fica registrado e auditável.
  return NextResponse.json({ ok: true, evento_id: data.id });
}
