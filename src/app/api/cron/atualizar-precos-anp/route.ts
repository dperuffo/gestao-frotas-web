import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAnpPrecosXlsx } from "@/lib/anpPrecos";
import { buscarPlanilhaAnpMaisRecente } from "@/lib/anpFetch";

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
// de ~5min mesmo com o teto documentado de 15min). `buscarPlanilhaAnpMaisRecente`
// (src/lib/anpFetch.ts) fazia `fetch` pro site do gov.br SEM NENHUM
// timeout — se o gov.br demorar demais (comum, e pior ainda vindo de IP
// de datacenter), a promise fica pendurada indefinidamente. Um `await`
// pendurado não lança exceção nenhuma — os try/catch abaixo nunca
// disparam nesse caso, a requisição simplesmente nunca termina, até o
// proxy do Railway desistir de esperar e devolver o 502 cru pro
// Cloudflare repassar. Por isso o hardening de try/catch sozinho não
// resolvia: o problema nunca era uma exceção, era uma espera sem fim.
// Corrigido adicionando `AbortSignal.timeout(15000)` em cada tentativa de
// download (ver anpFetch.ts) — agora falha rápido e de forma
// diagnosticável (cai no catch abaixo, vira um JSON de erro claro) em vez
// de travar a requisição inteira.
//
// O try/catch abaixo continua valendo como rede de segurança pra
// qualquer OUTRA falha real (planilha corrompida, erro do Supabase etc.)
// — só não era, sozinho, suficiente pra esse caso específico.
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

    let busca;
    try {
      busca = await buscarPlanilhaAnpMaisRecente();
    } catch (e) {
      console.error("[cron/atualizar-precos-anp] falha ao buscar planilha:", e);
      return NextResponse.json(
        { erro: e instanceof Error ? e.message : "Falha ao buscar a planilha da ANP." },
        { status: 502 }
      );
    }

    let resultadoParse;
    try {
      resultadoParse = parseAnpPrecosXlsx(busca.buffer);
    } catch (e) {
      console.error("[cron/atualizar-precos-anp] falha ao interpretar a planilha:", e);
      return NextResponse.json(
        {
          erro: `Falha ao interpretar a planilha baixada: ${e instanceof Error ? e.message : String(e)}`,
          urlEncontrada: busca.urlEncontrada,
        },
        { status: 502 }
      );
    }
    const { registros, totalAntesDedupe, duplicadas, erros, porNivel } = resultadoParse;

    if (registros.length === 0) {
      return NextResponse.json(
        {
          erro: "Planilha baixada não tinha nenhuma linha válida.",
          urlEncontrada: busca.urlEncontrada,
        },
        { status: 502 }
      );
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
          {
            erro: `Falha ao gravar: ${error.message}. Lotes anteriores já foram mantidos.`,
            urlEncontrada: busca.urlEncontrada,
            sucessoParcial: sucesso,
          },
          { status: 500 }
        );
      }
      sucesso += lote.length;
    }

    revalidatePath("/inteligencia-rede");

    return NextResponse.json({
      urlEncontrada: busca.urlEncontrada,
      semana: `${busca.semanaInicio} a ${busca.semanaFim}`,
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
