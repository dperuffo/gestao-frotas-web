import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBigQueryClient, BASEDOSDADOS_PROJECT } from "@/lib/bigquery";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";

// Fase automatiza-anp-bigquery — passo 1 (diagnóstico, não é a automação
// final ainda). Antes de montar o pipeline semanal de verdade, precisamos
// confirmar duas coisas direto na fonte (em vez de confiar em busca na web,
// que deu informação contraditória sobre a atualidade dos dados):
//   1. quais datasets/tabelas relacionados a ANP o Base dos Dados realmente
//      tem disponíveis no projeto público "basedosdados";
//   2. a data mais recente de cada tabela candidata (via lastModifiedTime
//      dos metadados do BigQuery, e opcionalmente uma consulta MAX(coluna)
//      quando soubermos o nome da coluna de data).
//
// Uso:
//   GET /api/admin/anp-bigquery-check                → lista datasets "anp*"
//   GET /api/admin/anp-bigquery-check?dataset=X       → lista tabelas do dataset X, com metadados (linhas, última modificação)
//   GET /api/admin/anp-bigquery-check?dataset=X&table=Y&dateColumn=Z → roda MAX(Z) na tabela X.Y
//
// Restrito a administradores — evita qualquer pessoa gastar a cota gratuita
// do nosso projeto Google Cloud.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    return NextResponse.json({ erro: "Apenas administradores podem rodar este diagnóstico." }, { status: 403 });
  }

  // M2 — protege a cota (paga) do BigQuery: ferramenta de diagnóstico
  // interno, uso legítimo é esporádico.
  const limite = verificarLimite(`bigquery-check:${ipDaRequisicao(request)}`, 10, 10 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get("dataset");
  const tableId = searchParams.get("table");
  const dateColumn = searchParams.get("dateColumn");

  let bigquery;
  try {
    bigquery = getBigQueryClient();
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha ao criar cliente BigQuery." }, { status: 500 });
  }

  try {
    // Passo 3: MAX(coluna de data) numa tabela específica.
    if (datasetId && tableId && dateColumn) {
      const query = `SELECT MAX(\`${dateColumn}\`) AS mais_recente, MIN(\`${dateColumn}\`) AS mais_antiga, COUNT(*) AS total_linhas
                      FROM \`${BASEDOSDADOS_PROJECT}.${datasetId}.${tableId}\``;
      const [rows] = await bigquery.query({ query, location: "US" });
      return NextResponse.json({ dataset: datasetId, table: tableId, dateColumn, resultado: rows[0] });
    }

    // Passo 2: metadados das tabelas de um dataset específico.
    if (datasetId) {
      const dataset = bigquery.dataset(datasetId, { projectId: BASEDOSDADOS_PROJECT });
      const [tables] = await dataset.getTables();
      const detalhes = await Promise.all(
        tables.map(async (t) => {
          const [meta] = await t.getMetadata();
          return {
            tableId: t.id,
            numRows: meta.numRows,
            lastModifiedTime: meta.lastModifiedTime
              ? new Date(Number(meta.lastModifiedTime)).toISOString()
              : null,
            colunas: (meta.schema?.fields ?? []).map((f: { name: string; type: string }) => `${f.name} (${f.type})`),
          };
        })
      );
      return NextResponse.json({ dataset: datasetId, tabelas: detalhes });
    }

    // Passo 1: lista datasets do projeto público que parecem relacionados à ANP.
    const [datasets] = await bigquery.getDatasets({ projectId: BASEDOSDADOS_PROJECT });
    const relacionados = datasets
      .map((d) => d.id)
      .filter((id): id is string => !!id && id.toLowerCase().includes("anp"));
    return NextResponse.json({ totalDatasetsNoProjeto: datasets.length, datasetsRelacionadosAnp: relacionados });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Erro desconhecido ao consultar o BigQuery." },
      { status: 500 }
    );
  }
}
