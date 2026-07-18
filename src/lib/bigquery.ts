import { BigQuery } from "@google-cloud/bigquery";

// Fase automatiza-anp-bigquery — o Base dos Dados (basedosdados.org)
// disponibiliza os datasets abertos como datasets do BigQuery dentro do
// projeto público "basedosdados"; qualquer projeto Google Cloud com
// faturamento ativo pode consultá-los (a cota gratuita de 1TB/mês do
// BigQuery cobre folgadamente o uso semanal que planejamos aqui). O projeto
// "de cobrança" é o nosso (GCP_BILLING_PROJECT_ID), mas os dados em si vivem
// no projeto "basedosdados" — por isso os métodos abaixo sempre recebem
// { projectId: "basedosdados" } quando apontam pra tabelas/datasets, mas o
// client em si é instanciado com o NOSSO projeto (quem paga a consulta).
export const BASEDOSDADOS_PROJECT = "basedosdados";

let cliente: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (cliente) return cliente;

  const credenciaisRaw = process.env.GCP_BIGQUERY_CREDENTIALS_JSON;
  const projetoCobranca = process.env.GCP_BILLING_PROJECT_ID;

  if (!credenciaisRaw) {
    throw new Error("Variável de ambiente GCP_BIGQUERY_CREDENTIALS_JSON não configurada.");
  }
  if (!projetoCobranca) {
    throw new Error("Variável de ambiente GCP_BILLING_PROJECT_ID não configurada.");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(credenciaisRaw);
  } catch {
    throw new Error("GCP_BIGQUERY_CREDENTIALS_JSON não é um JSON válido — confira se colou o arquivo inteiro da chave de serviço.");
  }

  cliente = new BigQuery({
    projectId: projetoCobranca,
    credentials,
  });
  return cliente;
}
