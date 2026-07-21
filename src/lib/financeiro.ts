// Painel Financeiro (Fase 22): tipos e rótulos compartilhados entre a
// página do cliente, os formulários de orçamento/custos fixos e a API
// externa de custos fixos.

// Fase Financeiro-Fretes — pedido do Daniel: "Parcelas de fretes pagos
// popular painel financeiro em despesas". `marcar_pagamento_frete` agora
// insere em custos_fixos com tipo/origem 'frete' quando uma parcela
// (adiantamento ou saldo final) é confirmada como paga.
export const TIPOS_CUSTO_FIXO = ["seguro", "ipva", "licenciamento", "rastreamento", "multa", "pedagio", "frete", "outro"] as const;
export type TipoCustoFixo = (typeof TIPOS_CUSTO_FIXO)[number];

export const TIPO_CUSTO_FIXO_LABEL: Record<TipoCustoFixo, string> = {
  seguro: "Seguro",
  ipva: "IPVA",
  licenciamento: "Licenciamento",
  rastreamento: "Rastreamento",
  multa: "Multa",
  pedagio: "Pedágio",
  frete: "Frete",
  outro: "Outro",
};

export const CATEGORIAS_ORCAMENTO = ["geral", "combustivel", "manutencao", "custos_fixos"] as const;
export type CategoriaOrcamento = (typeof CATEGORIAS_ORCAMENTO)[number];

export const CATEGORIA_ORCAMENTO_LABEL: Record<CategoriaOrcamento, string> = {
  geral: "Geral (toda a frota)",
  combustivel: "Combustível",
  manutencao: "Manutenção",
  custos_fixos: "Custos fixos",
};

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Colunas do tipo `date` do Postgres (sem hora nem fuso, ex.: "competencia"
// de custos_fixos e o "mes" devolvido por indicadores_financeiros_evolucao)
// chegam do Supabase como string pura "AAAA-MM-DD". `new Date("2026-07-01")`
// interpreta isso como meia-noite UTC — e, ao formatar de volta com
// toLocaleDateString num fuso atrás de UTC (ex.: America/Sao_Paulo, UTC-3),
// o horário local vira "30/06 21:00", mostrando o mês/dia anterior. Essas
// duas funções evitam o Date/UTC por completo: parseiam a string na mão e
// nunca convertem fuso, então o mês exibido é sempre o mês que veio do
// banco.
export function formatarDataSemFuso(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

export function formatarMesAnoSemFuso(dataISO: string): string {
  const [ano, mes] = dataISO.slice(0, 10).split("-").map(Number);
  return `${NOMES_MES[mes - 1].slice(0, 3).toLowerCase()}./${String(ano).slice(2)}`;
}
