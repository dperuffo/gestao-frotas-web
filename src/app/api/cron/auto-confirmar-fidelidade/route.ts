import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { segredoConfere } from "@/lib/segredoConstante";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";

// Fase Atribuicao-Automatica-Fidelidade (28/08/2026, pedido do Daniel: a
// tela "Confirmar abastecimentos" do PWA Motorista não faz mais sentido
// agora que CPF é capturado — com fallback — em todos os pontos de entrada
// de abastecimento, e a atribuição ao motorista já é automática). Substitui
// o toque manual do motorista (RPC confirmar_abastecimento_fidelidade) por
// este job diário, que credita os pontos de fidelidade sozinho pra todo
// abastecimento já atribuído a um motorista (mesma lógica de match: veículo
// vinculado -> CPF -> nome). Idempotente — pode rodar todo dia sem creditar
// duas vezes (índice único em fidelidade_abastecimentos_confirmados).
//
// Mesmo padrão de autenticação/agendamento de /api/cron/gerar-insights-ia —
// configure o agendador (Vercel Cron, cron externo, pg_cron do Supabase)
// pra chamar esta rota 1x/dia com `Authorization: Bearer <CRON_SECRET>`.
export const runtime = "nodejs";
export const maxDuration = 60;

async function executar(request: Request) {
  const segredoEsperado = process.env.CRON_SECRET;
  if (!segredoEsperado) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  const autorizacao = request.headers.get("authorization");
  if (!segredoConfere(autorizacao, `Bearer ${segredoEsperado}`)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const limite = verificarLimite(`cron-auto-confirmar-fidelidade:${ipDaRequisicao(request)}`, 20, 5 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("auto_confirmar_abastecimentos_fidelidade");

  if (error) {
    return NextResponse.json({ erro: `Falha ao auto-confirmar fidelidade: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function GET(request: Request) {
  return executar(request);
}

export async function POST(request: Request) {
  return executar(request);
}
