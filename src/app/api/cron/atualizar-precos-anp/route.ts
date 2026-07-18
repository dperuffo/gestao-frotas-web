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

async function executar(request: Request) {
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
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao buscar a planilha da ANP." },
      { status: 502 }
    );
  }

  const { registros, totalAntesDedupe, duplicadas, erros, porNivel } = parseAnpPrecosXlsx(busca.buffer);

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
}

export async function GET(request: Request) {
  return executar(request);
}

export async function POST(request: Request) {
  return executar(request);
}
