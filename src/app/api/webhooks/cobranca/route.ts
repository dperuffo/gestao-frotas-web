import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Fase P0.6 — webhook do provedor de cobrança (pagamento confirmado chega
// aqui de forma assíncrona, quando um gateway real — Asaas/Cora — estiver
// plugado). Mesmo padrão do webhook fiscal (src/app/api/webhooks/fiscal/
// route.ts): grava o evento bruto ANTES de processar (nada se perde se o
// processamento falhar) e usa segredo simples via header
// (COBRANCA_WEBHOOK_SECRET), mesmo espírito do FISCAL_WEBHOOK_SECRET/
// CRON_SECRET já usados no projeto.
export const runtime = "nodejs";

const TIPOS_EVENTO_PAGAMENTO = ["cobranca_paga", "cobranca_vencida", "cobranca_cancelada"] as const;

export async function POST(request: Request) {
  const segredoEsperado = process.env.COBRANCA_WEBHOOK_SECRET;
  if (!segredoEsperado) {
    return NextResponse.json({ erro: "COBRANCA_WEBHOOK_SECRET não configurado no servidor." }, { status: 500 });
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
    .from("cobranca_webhook_eventos")
    .insert({
      provedor: typeof corpo.provedor === "string" ? corpo.provedor : "desconhecido",
      tipo_evento: typeof corpo.tipo_evento === "string" ? corpo.tipo_evento : null,
      referencia: typeof corpo.gateway_ref === "string" ? corpo.gateway_ref : null,
      payload: corpo as never,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ erro: `Falha ao registrar o evento: ${error.message}` }, { status: 500 });
  }

  const resultadoProcessamento = await processarEventoCobranca(supabase, corpo);

  await supabase
    .from("cobranca_webhook_eventos")
    .update({
      processado: resultadoProcessamento.ok,
      processado_em: new Date().toISOString(),
      erro_processamento: resultadoProcessamento.ok ? null : resultadoProcessamento.erro,
    })
    .eq("id", data.id);

  return NextResponse.json({ ok: true, evento_id: data.id, processamento: resultadoProcessamento });
}

type ResultadoProcessamento = { ok: true } | { ok: false; erro: string };

async function processarEventoCobranca(
  supabase: ReturnType<typeof createAdminClient>,
  corpo: Record<string, unknown>
): Promise<ResultadoProcessamento> {
  const tipoEvento = typeof corpo.tipo_evento === "string" ? corpo.tipo_evento : "";
  if (!(TIPOS_EVENTO_PAGAMENTO as readonly string[]).includes(tipoEvento)) {
    return { ok: true };
  }

  const gatewayRef = typeof corpo.gateway_ref === "string" ? corpo.gateway_ref : null;
  if (!gatewayRef) {
    return { ok: false, erro: "Evento sem gateway_ref — não dá pra saber qual título baixar." };
  }

  const { data: conta } = await supabase
    .from("contas_receber")
    .select("id, valor_original, valor_pago, status")
    .eq("gateway_ref", gatewayRef)
    .maybeSingle();
  if (!conta) {
    return { ok: false, erro: `Nenhuma conta a receber encontrada para gateway_ref "${gatewayRef}".` };
  }

  if (tipoEvento === "cobranca_paga") {
    if (conta.status === "pago") return { ok: true }; // já processado, idempotente
    const valorPago = typeof corpo.valor_pago === "number" ? corpo.valor_pago : conta.valor_original - conta.valor_pago;
    const { error } = await supabase.rpc("baixar_conta_receber", {
      p_conta_id: conta.id,
      p_valor: valorPago,
      p_forma: typeof corpo.forma === "string" ? corpo.forma : "gateway",
      p_gateway_ref: gatewayRef,
      p_observacao: "Baixa automática via webhook de cobrança.",
    });
    if (error) return { ok: false, erro: error.message };
    return { ok: true };
  }

  if (tipoEvento === "cobranca_cancelada") {
    const { error } = await supabase.rpc("cancelar_conta_receber", { p_conta_id: conta.id });
    if (error) return { ok: false, erro: error.message };
    return { ok: true };
  }

  // "cobranca_vencida" — só informativo (o aging de contas_receber já
  // deriva "vencido" a partir da data, não precisa de status próprio).
  return { ok: true };
}
