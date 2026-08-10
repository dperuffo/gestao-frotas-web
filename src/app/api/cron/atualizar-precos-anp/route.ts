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

// ATUALIZAÇÃO (10/08/2026, fase automatiza-anp-fonte-fixa): esta rota
// deixou de ser o caminho AGENDADO — o pg_cron passou a chamar
// diretamente a Edge Function `atualizar-precos-anp` (Supabase), não mais
// esta rota. Motivo: confirmamos nessa data que o egress do Railway está
// bloqueado pro domínio www.gov.br (fetch failed, erro de rede/TCP puro —
// testes de fora do Railway baixam o mesmo arquivo normalmente). Testando,
// achamos que o egress do Supabase Edge Functions CONSEGUE alcançar o
// gov.br — por isso a tarefa migrou de infra, não só de mecanismo.
//
// Esta rota continua funcional e é mantida como caminho de disparo manual
// (ex.: `curl` com o CRON_SECRET) caso o bloqueio de rede do Railway seja
// resolvido no futuro (proxy de saída, etc.) — nesse caso poderia voltar a
// ser o caminho principal outra vez, sem precisar reescrever nada aqui.
//
// Achado real (27/07/2026, investigando por que a rotina de segunda-feira
// "sumiu" — o Daniel reportou e conferimos junto): o disparo do pg_cron
// chegou a acontecer (log do próprio pg_cron mostra sucesso), mas a
// resposta HTTP foi um 502 "cru" da Cloudflare — o handler nunca chegou a
// rodar. CAUSA: Railway atrás de um proxy de borda com timeout próprio, e
// o fetch pro gov.br não tinha timeout nenhum — corrigido com
// `AbortSignal.timeout` em anpFetch.ts.
//
// Achado real (10/08/2026, Daniel reportou de novo — rotina falhando
// silenciosamente toda segunda desde 18/07): dessa vez o timeout
// funcionou, mas o fetch retornava `fetch failed` — bloqueio de rede
// Railway↔gov.br (não um bug de código, confirmado testando de fora).
// Investigando isso, achamos TAMBÉM que o mecanismo de descoberta do
// arquivo (adivinhar o nome por aritmética de data) tinha uma segunda
// fragilidade independente: a ANP nem sempre nomeia o arquivo semanal do
// jeito esperado (achamos exceções reais em 2026 — traço em vez de
// underscore, sufixo de reemissão). Corrigido em anpFetch.ts lendo a
// listagem real de arquivos da ANP em vez de adivinhar.
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
