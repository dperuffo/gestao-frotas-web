import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { segredoConfere } from "@/lib/segredoConstante";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";
import { conciliarAutomaticoParaEmpresa } from "@/lib/conciliacaoAutomatica";

// Auditoria de automação (13/09/2026, pedido do Daniel) — o matching de alta
// confiança (valor + data + fornecedor, ver sugerirContas em
// conciliacaoBancaria.ts) só rodava quando alguém clicava "Conciliar
// automático" em /conciliacao-bancaria. O upload do extrato continua manual
// (depende do banco), mas a etapa de matching/baixa não precisava esperar um
// clique: agora roda sozinha 1x/dia pra todas as empresas com lançamentos
// pendentes.
//
// A lógica em si (matching + chamada das RPCs baixar_conta_pagar/
// baixar_conta_receber) mora em conciliarAutomaticoParaEmpresa
// (src/lib/conciliacaoAutomatica.ts) e é a MESMA usada pelo clique manual —
// só troca o client (aqui é o admin/service role, sem sessão de usuário) e o
// autor gravado em conciliado_por. Escolhido rota /api/cron/* + CRON_SECRET
// (em vez de reescrever o matching como função SQL) porque a lógica de
// similaridade de nome (normalização de acentos, remoção de sufixo
// societário, comparação de tokens) já existe em TypeScript testado e usado
// pelo fluxo manual — duplicar isso em plpgsql arriscaria os dois
// divergirem com o tempo. Mesmo padrão de auth/rate limit de
// /api/cron/auto-confirmar-fidelidade.
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

  const limite = verificarLimite(`cron-conciliacao-automatica:${ipDaRequisicao(request)}`, 20, 5 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const supabase = createAdminClient();

  const { data: empresasComPendentes, error: erroBusca } = await supabase
    .from("extrato_bancario_lancamentos")
    .select("empresa_id")
    .eq("status", "pendente");

  if (erroBusca) {
    return NextResponse.json({ erro: `Falha ao buscar lançamentos pendentes: ${erroBusca.message}` }, { status: 500 });
  }

  const empresaIds = Array.from(new Set((empresasComPendentes ?? []).map((l) => l.empresa_id)));

  const resultados = [];
  let totalConciliados = 0;
  for (const empresaId of empresaIds) {
    const resultado = await conciliarAutomaticoParaEmpresa(supabase, empresaId, "automático (cron diário)");
    totalConciliados += resultado.conciliados;
    resultados.push(resultado);
  }

  return NextResponse.json({
    empresasProcessadas: empresaIds.length,
    totalConciliados,
    resultados,
  });
}

export async function GET(request: Request) {
  return executar(request);
}

export async function POST(request: Request) {
  return executar(request);
}
