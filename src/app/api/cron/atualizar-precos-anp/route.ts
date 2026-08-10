import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAnpPrecosAcumulado } from "@/lib/anpPrecos";
import { buscarPlanilhasAnpAcumuladas } from "@/lib/anpFetch";

// Fase automatiza-anp-bigquery — atualização semanal automática da série de
// preços de referência ANP (tabela anp_precos_referencia), sem depender de
// upload manual. Baixa direto do link previsível da ANP (ver
// src/lib/anpFetch.ts) e reaproveita o mesmo parser da importação manual
// (src/lib/anpPrecos.ts) — zero duplicação de lógica entre os dois
// caminhos, só muda de onde vem o arquivo.
//
// Protegida por CRON_SECRET, mesmo padrão de /api/cron/sync-profrotas —
// disparada por um job do pg_cron no Supabase (ver migração
// agenda_atualizacao_precos_anp), não por sessão de usuário.
export const runtime = "nodejs";
export const maxDuration = 120;

// Achado real (27/07/2026, investigando por que a rotina de segunda-feira
// "sumiu" — o Daniel reportou e conferimos junto): o disparo do pg_cron
// chegou a acontecer (log do próprio pg_cron mostra sucesso), mas a
// resposta HTTP foi um 502 "cru" da Cloudflare (texto puro "error code:
// 502", SEM o corpo JSON que os catches abaixo devolvem) — ou seja, o
// handler nunca chegou a rodar nenhum `return NextResponse.json(...)`.
//
// CAUSA RAIZ CONFIRMADA: o app roda no Railway (não na Vercel), como UM
// processo Node único (`npm run start`) atrás do proxy de borda do
// próprio Railway — que tem um timeout de requisição (na prática, relatos
// de ~5min mesmo com o teto documentado de 15min). O fetch pro site do
// gov.br não tinha nenhum timeout — se o gov.br demorar demais pra
// responder (comum, e pior ainda vindo de IP de datacenter), a promise
// fica pendurada indefinidamente. Corrigido com `AbortSignal.timeout` em
// cada tentativa de download (ver anpFetch.ts) — agora falha rápido e de
// forma diagnosticável em vez de travar a requisição inteira.
//
// SEGUNDO ACHADO (10/08/2026, Daniel reportou de novo — rotina falhando
// silenciosamente TODA segunda desde 18/07): dessa vez o `AbortSignal.
// timeout` funcionou (falha em ~1.3s, log claro), mas o `fetch` continuava
// retornando `fetch failed` — erro de rede/TCP puro, sem status HTTP —
// pras 5 URLs candidatas. Confirmado por fora (curl de uma rede diferente
// baixa o mesmo arquivo normalmente, HTTP 200 em <1s): é um bloqueio de
// rede entre o egress do Railway e www.gov.br, não um bug de código. Isso
// CONTINUA sem solução definitiva (precisa de proxy de saída ou mover essa
// busca pra outra infra) — fica registrado aqui pra não se perder.
//
// Investigando esse segundo problema, achamos TAMBÉM que o mecanismo de
// descoberta do arquivo (antes: adivinhar o nome por aritmética de data)
// tinha uma segunda fragilidade independente do bloqueio de rede: a ANP
// nem sempre nomeia o arquivo semanal do jeito esperado (achamos exceções
// reais em 2026 — traço em vez de underscore, sufixo de reemissão). Por
// isso trocamos, nesta mesma fase, pra buscar os arquivos ACUMULADOS de
// URL fixa da ANP (nunca precisam ser adivinhados — ver anpFetch.ts) e um
// parser novo que sabe ler esse formato (ver anpPrecos.ts). Isso NÃO
// resolve o bloqueio de rede acima — é uma correção de robustez separada,
// que evita um segundo motivo de falha independente do primeiro.
async function executar(request: Request) {
  try {
    const segredoEsperado = process.env.CRON_SECRET;
    if (!segredoEsperado) {
      return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
    }
    const autorizacao = request.headers.get("authorization");
    if (autorizacao !== `Bearer ${segredoEsperado}`) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    let buffers;
    try {
      buffers = await buscarPlanilhasAnpAcumuladas();
    } catch (e) {
      console.error("[cron/atualizar-precos-anp] falha ao buscar planilhas:", e);
      return NextResponse.json(
        { erro: e instanceof Error ? e.message : "Falha ao buscar as planilhas da ANP." },
        { status: 502 }
      );
    }

    let resultadoParse;
    try {
      resultadoParse = parseAnpPrecosAcumulado(buffers);
    } catch (e) {
      console.error("[cron/atualizar-precos-anp] falha ao interpretar as planilhas:", e);
      return NextResponse.json(
        { erro: `Falha ao interpretar as planilhas baixadas: ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 }
      );
    }
    const { registros, totalAntesDedupe, duplicadas, erros, porNivel } = resultadoParse;

    if (registros.length === 0) {
      return NextResponse.json({ erro: "Planilhas baixadas não tinham nenhuma linha válida para a semana mais recente." }, { status: 502 });
    }

    const supabase = createAdminClient();
    let sucesso = 0;
    const tamanhoLote = 500;
    for (let i = 0; i < registros.length; i += tamanhoLote) {
      const lote = registros.slice(i, i + tamanhoLote);
      const { error } = await supabase
        .from("anp_precos_referencia")
        .upsert(lote, { onConflict: "nivel,data_inicial,data_final,regiao,estado,municipio,produto" });
      if (error) {
        return NextResponse.json(
          { erro: `Falha ao gravar: ${error.message}. Lotes anteriores já foram mantidos.`, sucessoParcial: sucesso },
          { status: 500 }
        );
      }
      sucesso += lote.length;
    }

    revalidatePath("/inteligencia-rede");

    return NextResponse.json({
      semana: registros[0] ? `${registros[0].data_inicial} a ${registros[0].data_final}` : null,
      total: totalAntesDedupe + erros,
      sucesso,
      erros,
      porNivel,
      duplicadas,
    });
  } catch (e) {
    // Rede de segurança final — qualquer coisa não prevista acima (ex.:
    // exceção síncrona fora dos blocos já protegidos) ainda vira um JSON
    // de erro com log detalhado, em vez de um 502 opaco da plataforma.
    console.error("[cron/atualizar-precos-anp] falha inesperada:", e);
    return NextResponse.json(
      { erro: e instanceof Error ? `Falha inesperada: ${e.message}` : "Falha inesperada." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return executar(request);
}

export async function POST(request: Request) {
  return executar(request);
}
