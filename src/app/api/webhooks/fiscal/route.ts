import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { segredoConfere } from "@/lib/segredoConstante";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";

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
  if (!segredoConfere(request.headers.get("x-webhook-secret"), segredoEsperado)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  // M2 — defesa em profundidade contra força bruta do segredo do webhook.
  const limite = verificarLimite(`webhook-fiscal:${ipDaRequisicao(request)}`, 30, 5 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

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

  // Fase P0.2 — processamento de verdade: atualiza o fretes_cte
  // correspondente. O provedor Simulador resolve tudo na hora (síncrono),
  // então este caminho serve principalmente pra um provedor real
  // (assíncrono) e pra reconciliação manual (reenviar um evento perdido).
  const resultadoProcessamento = await processarEventoCte(supabase, corpo);

  await supabase
    .from("fiscal_webhook_eventos")
    .update({
      processado: resultadoProcessamento.ok,
      processado_em: new Date().toISOString(),
      erro_processamento: resultadoProcessamento.ok ? null : resultadoProcessamento.erro,
    })
    .eq("id", data.id);

  return NextResponse.json({ ok: true, evento_id: data.id, processamento: resultadoProcessamento });
}

type ResultadoProcessamento = { ok: true } | { ok: false; erro: string };

const TIPOS_EVENTO_CTE = ["cte_autorizado", "cte_rejeitado", "cte_cancelado"] as const;

async function processarEventoCte(
  supabase: ReturnType<typeof createAdminClient>,
  corpo: Record<string, unknown>
): Promise<ResultadoProcessamento> {
  const tipoEvento = typeof corpo.tipo_evento === "string" ? corpo.tipo_evento : "";
  if (!(TIPOS_EVENTO_CTE as readonly string[]).includes(tipoEvento)) {
    // Não é um evento de CT-e (ou é um tipo ainda não tratado, ex.: MDF-e
    // na P0.3) — não é erro, só não há o que processar aqui.
    return { ok: true };
  }

  const chaveAcesso = typeof corpo.referencia === "string" ? corpo.referencia : null;
  const provedorRef = typeof corpo.provedor_ref === "string" ? corpo.provedor_ref : null;
  const numeroCte = typeof corpo.numero_cte === "string" ? corpo.numero_cte : null;
  const serie = typeof corpo.serie === "string" ? corpo.serie : null;

  // Match primário: chave de acesso (já conhecida). Fallback: quando o
  // evento de autorização chega e a chave só é atribuída AGORA (linha
  // ainda em 'enviando' sem chave_acesso) — casa por provedor_ref + número
  // + série, que já são conhecidos desde a criação do rascunho.
  let query = supabase.from("fretes_cte").select("id, status").limit(1);
  if (chaveAcesso) {
    query = supabase.from("fretes_cte").select("id, status").eq("chave_acesso", chaveAcesso).limit(1);
  } else if (provedorRef && numeroCte && serie) {
    query = supabase
      .from("fretes_cte")
      .select("id, status")
      .eq("provedor_ref", provedorRef)
      .eq("numero_cte", numeroCte)
      .eq("serie", serie)
      .eq("status", "enviando")
      .limit(1);
  } else {
    return { ok: false, erro: "Evento sem referência suficiente (chave_acesso ou provedor_ref+numero_cte+serie)." };
  }

  const { data: linha } = await query.maybeSingle();
  if (!linha) {
    return { ok: false, erro: "Nenhum CT-e encontrado para esta referência." };
  }

  const atualizacao: Partial<{
    atualizado_em: string;
    status: string;
    chave_acesso: string;
    protocolo_autorizacao: string;
    data_emissao: string;
    motivo_rejeicao: string;
  }> = { atualizado_em: new Date().toISOString() };
  if (tipoEvento === "cte_autorizado") {
    atualizacao.status = "autorizado";
    if (chaveAcesso) atualizacao.chave_acesso = chaveAcesso;
    if (typeof corpo.protocolo === "string") atualizacao.protocolo_autorizacao = corpo.protocolo;
    atualizacao.data_emissao = typeof corpo.data_autorizacao === "string" ? corpo.data_autorizacao : new Date().toISOString();
  } else if (tipoEvento === "cte_rejeitado") {
    atualizacao.status = "rejeitado";
    atualizacao.motivo_rejeicao = typeof corpo.motivo === "string" ? corpo.motivo : "Rejeitado pela SEFAZ (via webhook).";
  } else if (tipoEvento === "cte_cancelado") {
    atualizacao.status = "cancelado";
    atualizacao.motivo_rejeicao = `Cancelado: ${typeof corpo.motivo === "string" ? corpo.motivo : "sem justificativa informada"}`;
  }

  const { error: erroUpdate } = await supabase.from("fretes_cte").update(atualizacao).eq("id", linha.id);
  if (erroUpdate) return { ok: false, erro: erroUpdate.message };
  return { ok: true };
}
