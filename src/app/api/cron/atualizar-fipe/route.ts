import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { buscarPrecoFipePorCodigo, buscarHistoricoFipe, parsePrecoFipe, type TipoVeiculoFipe } from "@/lib/fipe";
import { segredoConfere } from "@/lib/segredoConstante";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

// Fase TCO 2 (29/07/2026) — refresh mensal do valor FIPE de todo veículo já
// vinculado (fipe_tipo_veiculo/codigo_fipe/fipe_ano_codigo preenchidos),
// alimentando cadastro_veiculos_fipe_historico pra construir a curva de
// depreciação real usada no TCO. Mesmo padrão de proteção/estrutura de
// /api/cron/atualizar-precos-anp: CRON_SECRET via header, runtime nodejs,
// maxDuration alto (aqui pode ser bem mais que a ANP — um request por
// veículo vinculado), client admin (service role, ignora RLS — roda fora de
// sessão de usuário).
export const runtime = "nodejs";
export const maxDuration = 300;

async function executar(request: Request) {
  try {
    const segredoEsperado = process.env.CRON_SECRET;
    if (!segredoEsperado) {
      return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
    }
    const autorizacao = request.headers.get("authorization");
    if (!segredoConfere(autorizacao, `Bearer ${segredoEsperado}`)) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    // M2 — mesma defesa em profundidade contra força bruta do CRON_SECRET
    // usada em /api/cron/atualizar-precos-anp.
    const limite = verificarLimite(`cron-fipe:${ipDaRequisicao(request)}`, 20, 5 * 60 * 1000);
    if (!limite.permitido) return respostaLimiteExcedido(limite);

    const supabase = createAdminClient();

    const { data: veiculos, error: erroBusca } = await supabase
      .from("cadastro_veiculos")
      .select("id, cnpj_frota, placa, codigo_fipe, fipe_tipo_veiculo, fipe_ano_codigo")
      .not("codigo_fipe", "is", null)
      .not("fipe_tipo_veiculo", "is", null)
      .not("fipe_ano_codigo", "is", null);

    if (erroBusca) {
      return NextResponse.json({ erro: `Falha ao listar veículos vinculados: ${erroBusca.message}` }, { status: 500 });
    }

    let sucesso = 0;
    const falhas: string[] = [];

    for (const v of veiculos ?? []) {
      if (!v.codigo_fipe || !v.fipe_tipo_veiculo || !v.fipe_ano_codigo) continue;
      try {
        const preco = await buscarPrecoFipePorCodigo(v.fipe_tipo_veiculo as TipoVeiculoFipe, v.codigo_fipe, v.fipe_ano_codigo);
        const valorAtual = parsePrecoFipe(preco.price);

        const { error: erroUpdate } = await supabase
          .from("cadastro_veiculos")
          .update({ valor_fipe: valorAtual, combustivel_fipe: preco.fuel, mes_referencia: preco.referenceMonth })
          .eq("id", v.id);
        if (erroUpdate) throw new Error(erroUpdate.message);

        // Busca pelo /history (não só o preço avulso) pra gravar sempre com
        // referencia_codigo (campo "reference", cresce 1 por mês — permite
        // ordenar os meses sem parsear texto em português) e, de quebra,
        // recuperar meses que porventura tenham ficado sem histórico.
        const historico = await buscarHistoricoFipe(v.fipe_tipo_veiculo as TipoVeiculoFipe, v.codigo_fipe, v.fipe_ano_codigo);
        if (historico.priceHistory.length > 0) {
          const { error: erroHistorico } = await supabase.from("cadastro_veiculos_fipe_historico").upsert(
            historico.priceHistory.map((item) => ({
              cadastro_veiculo_id: v.id,
              cnpj_frota: v.cnpj_frota,
              placa: v.placa,
              codigo_fipe: v.codigo_fipe,
              mes_referencia: item.month,
              referencia_codigo: Number(item.reference) || null,
              valor: parsePrecoFipe(item.price),
            })),
            { onConflict: "cadastro_veiculo_id,mes_referencia" }
          );
          if (erroHistorico) throw new Error(erroHistorico.message);
        }

        sucesso++;
      } catch (e) {
        falhas.push(`${v.placa} (${v.codigo_fipe}): ${e instanceof Error ? e.message : "erro desconhecido"}`);
      }
    }

    revalidatePath("/tco");

    return NextResponse.json({
      totalVinculados: veiculos?.length ?? 0,
      sucesso,
      falhas: falhas.length,
      detalheFalhas: falhas.slice(0, 20),
    });
  } catch (e) {
    // Fase Observabilidade-Fundacao (14/08/2026) — migrado pro logger
    // estruturado como demonstração do padrão novo (ver src/lib/logger.ts);
    // "[cron/atualizar-fipe]" virou o nome do módulo.
    await logger.error("cron/atualizar-fipe", "Falha inesperada", e);
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
