import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseAnpPrecosXlsx } from "@/lib/anpPrecos";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";

export type ResultadoImportacaoPrecosAnp =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; porNivel: Record<string, number>; duplicadas: number };

// Fase corrige-bloqueio-cloudflare-waf — mesma razão do route.ts de
// /api/postos/importar: trocado de Server Action pra Route Handler pra
// escapar da regra do WAF que confunde o protocolo de Server Actions com o
// CVE-2025-55183 (já corrigido nesta versão do Next, mas o Free plan da
// Cloudflare não deixa criar exceção pra essa regra). Esta é a importação
// oficial de preços de referência ANP (tabela anp_precos_referencia), usada
// pela Roteirização e pela calculadora de lucro do motorista.
//
// Fase automatiza-anp-bigquery — o parsing em si (as 5 abas BRASIL/REGIOES/
// ESTADOS/MUNICIPIOS/CAPITAIS) foi extraído pra src/lib/anpPrecos.ts, pra
// ser reaproveitado também pela importação automática semanal
// (/api/cron/atualizar-precos-anp). Esta rota continua existindo pra quem
// preferir subir o arquivo manualmente.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    return NextResponse.json<ResultadoImportacaoPrecosAnp>({
      erro: "Apenas administradores podem importar a série de preços oficiais da ANP.",
    });
  }

  // M2 — protege processamento pesado (5 abas, parsing de milhares de linhas).
  const limite = verificarLimite(`importar-precos-anp:${ipDaRequisicao(request)}`, 10, 10 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json<ResultadoImportacaoPrecosAnp>({ erro: "Selecione o arquivo precos_anp.xlsx." });
  }

  const buffer = await arquivo.arrayBuffer();
  const { registros, totalAntesDedupe, duplicadas, erros, porNivel } = parseAnpPrecosXlsx(buffer);

  if (registros.length === 0) {
    return NextResponse.json<ResultadoImportacaoPrecosAnp>({
      erro: "Nenhuma linha válida encontrada. Confira se o arquivo tem as abas BRASIL, REGIOES, ESTADOS, MUNICIPIOS e CAPITAIS.",
    });
  }

  let sucesso = 0;
  const tamanhoLote = 500;
  for (let i = 0; i < registros.length; i += tamanhoLote) {
    const lote = registros.slice(i, i + tamanhoLote);
    const { error } = await supabase
      .from("anp_precos_referencia")
      .upsert(lote, { onConflict: "nivel,data_inicial,data_final,regiao,estado,municipio,produto" });
    if (error) {
      return NextResponse.json<ResultadoImportacaoPrecosAnp>({
        erro: `Falha ao gravar: ${error.message}. Lotes anteriores já foram mantidos.`,
      });
    }
    sucesso += lote.length;
  }

  revalidatePath("/inteligencia-rede");

  return NextResponse.json<ResultadoImportacaoPrecosAnp>({
    total: totalAntesDedupe + erros,
    sucesso,
    erros,
    porNivel,
    duplicadas,
  });
}
