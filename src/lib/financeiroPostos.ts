// Fase 27.64 — Painel Financeiro do Posto: contas a receber (faturas, geradas
// pelo robô a partir dos abastecimentos fornecidos, agrupados por negociação)
// e contas a pagar (despesas, lançadas manualmente). Tipos e helpers
// compartilhados entre a página, as Server Actions e os componentes.

export const TIPOS_DESPESA_POSTO = [
  "combustivel_distribuidora",
  "salarios",
  "manutencao",
  "impostos",
  "aluguel",
  "energia",
  "outro",
] as const;
export type TipoDespesaPosto = (typeof TIPOS_DESPESA_POSTO)[number];

export const TIPO_DESPESA_POSTO_LABEL: Record<TipoDespesaPosto, string> = {
  combustivel_distribuidora: "Combustível / Distribuidora",
  salarios: "Salários",
  manutencao: "Manutenção",
  impostos: "Impostos",
  aluguel: "Aluguel",
  energia: "Energia",
  outro: "Outro",
};

// Status "de verdade" gravado no banco — DESPESAS do posto (contas a
// pagar, lançamento manual). "Vencida" não é um valor de status — é
// derivado (status = 'aberta' e vencimento < hoje), mesmo espírito de
// "Vigente" em negociacoes_postos (Fase 27.54): evita ter que voltar toda
// despesa já paga pra reabrir se o robô de virada de dia atrasar.
export const STATUS_FATURA_POSTO = ["aberta", "paga", "cancelada"] as const;
export type StatusFaturaPosto = (typeof STATUS_FATURA_POSTO)[number];

export type StatusFaturaExibicao = StatusFaturaPosto | "vencida";

export const STATUS_FATURA_LABEL: Record<StatusFaturaExibicao, string> = {
  aberta: "Em aberto",
  vencida: "Vencida",
  paga: "Paga",
  cancelada: "Cancelada",
};

export function statusFaturaExibicao(status: string, vencimento: string, hojeIso: string): StatusFaturaExibicao {
  if (status === "aberta" && vencimento < hojeIso) return "vencida";
  return status as StatusFaturaExibicao;
}

// Fase CICLOS-6 — pedido do Daniel: novo modelo de ciclo de
// abastecimento/pagamento (janelas fixas ancoradas no calendário, robô em
// 2 fases — ver gerar_faturas_postos_robo() no banco). Status de FATURA
// (faturas_postos, contas a receber do posto) é um conjunto DIFERENTE do
// de despesa acima — por isso um tipo/label/derivação à parte, sem tocar
// em STATUS_FATURA_POSTO (que continua servindo só pras despesas):
//   - fechada: janela de abastecimento terminou, mas o boleto ainda não foi
//     gerado (esperando NFe chegar — ver data_geracao_boleto no banco).
//   - a_vencer: boleto gerado, valor travado, aguardando pagamento.
//   - vencida: DERIVADO (a_vencer + vencimento < hoje), nunca gravado.
//   - paga / cancelada: iguais ao modelo antigo.
// O estado "Aberto" (janela de abastecimento em andamento) não é um status
// de faturas_postos — a linha nem existe ainda nessa fase, é representado
// pela RPC ciclos_abertos_postos() (ver ciclosAbertos.ts).
export const STATUS_CICLO_FATURA = ["fechada", "a_vencer", "paga", "cancelada"] as const;
export type StatusCicloFatura = (typeof STATUS_CICLO_FATURA)[number];

export type StatusCicloFaturaExibicao = StatusCicloFatura | "vencida";

export const STATUS_CICLO_FATURA_LABEL: Record<StatusCicloFaturaExibicao, string> = {
  fechada: "Fechada",
  a_vencer: "A vencer",
  vencida: "Vencida",
  paga: "Paga",
  cancelada: "Cancelada",
};

export function statusCicloFaturaExibicao(status: string, vencimento: string, hojeIso: string): StatusCicloFaturaExibicao {
  if (status === "a_vencer" && vencimento < hojeIso) return "vencida";
  return status as StatusCicloFaturaExibicao;
}

// Seletor de período — as opções rápidas pedidas (dia/semana/quinzena/mês) +
// personalizado. Tudo resolvido a partir de searchParams no servidor, sem
// estado de cliente: mesmo padrão de filtro por URL já usado em /negociacoes
// e /abastecimentos.
export const PERIODOS_FINANCEIRO = ["hoje", "7dias", "15dias", "mes", "personalizado"] as const;
export type PeriodoFinanceiro = (typeof PERIODOS_FINANCEIRO)[number];

export const PERIODO_FINANCEIRO_LABEL: Record<PeriodoFinanceiro, string> = {
  hoje: "Hoje",
  "7dias": "7 dias",
  "15dias": "15 dias",
  mes: "Mês atual",
  personalizado: "Personalizado",
};

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

// Resolve o intervalo [inicio, fim] (ambos incluídos, "YYYY-MM-DD") a partir
// do período escolhido. "personalizado" usa inicio/fim vindos da URL, com
// fallback pros últimos 30 dias se vierem vazios/ inválidos.
export function resolverPeriodoFinanceiro(
  periodo: string | undefined,
  inicioParam: string | undefined,
  fimParam: string | undefined
): { periodo: PeriodoFinanceiro; inicio: string; fim: string } {
  const hoje = new Date();
  const periodoValido = (PERIODOS_FINANCEIRO as readonly string[]).includes(periodo ?? "")
    ? (periodo as PeriodoFinanceiro)
    : "15dias";

  if (periodoValido === "personalizado" && inicioParam && fimParam && inicioParam <= fimParam) {
    return { periodo: periodoValido, inicio: inicioParam, fim: fimParam };
  }

  const fim = paraIso(hoje);
  let inicioData = new Date(hoje);
  if (periodoValido === "hoje") {
    // inicio = fim (já é o padrão)
  } else if (periodoValido === "7dias") {
    inicioData = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000);
  } else if (periodoValido === "mes") {
    inicioData = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  } else {
    // "15dias" (padrão) e fallback de "personalizado" inválido
    inicioData = new Date(hoje.getTime() - 14 * 24 * 60 * 60 * 1000);
  }

  return { periodo: periodoValido, inicio: paraIso(inicioData), fim };
}

// Fase 27.81 — achado real (Daniel reportou "Fluxo de caixa previsto" sempre
// vazio): resolverPeriodoFinanceiro() sempre devolve uma janela pra TRÁS
// (fim = hoje) pras opções rápidas — faz sentido pra "Recebido no período"/
// "Pago no período" (são retrospectivos, olham pago_em), mas o gráfico e os
// indicadores "vencendo no período"/"saldo previsto" são PROSPECTIVOS (olham
// vencimento futuro) e usavam a mesma janela por engano, então uma fatura
// com vencimento amanhã nunca aparecia no "15 dias" default. Esta função
// devolve uma janela separada, pra frente a partir de hoje, com a mesma
// duração em dias da opção rápida escolhida ("mês atual" = resto do mês).
// "Personalizado" continua igual (o usuário já escolhe a direção manualmente).
export function resolverJanelaPrevista(
  periodo: PeriodoFinanceiro,
  inicio: string,
  fim: string,
  hojeIso: string
): { inicio: string; fim: string } {
  if (periodo === "personalizado") return { inicio, fim };

  if (periodo === "mes") {
    const hoje = new Date(hojeIso + "T00:00:00Z");
    const fimMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0));
    return { inicio: hojeIso, fim: paraIso(fimMes) };
  }

  const msPorDia = 24 * 60 * 60 * 1000;
  const qtdDias = Math.round((new Date(fim + "T00:00:00Z").getTime() - new Date(inicio + "T00:00:00Z").getTime()) / msPorDia);
  const fimPrevisto = new Date(new Date(hojeIso + "T00:00:00Z").getTime() + qtdDias * msPorDia);
  return { inicio: hojeIso, fim: paraIso(fimPrevisto) };
}

// Faixas de atraso (aging list) — padrão de mercado citado em ferramentas de
// cobrança/ERP (0-15, 16-30, 31-60, 61-90, 90+ dias).
export const FAIXAS_AGING = [
  { chave: "0-15", label: "0 a 15 dias", min: 0, max: 15 },
  { chave: "16-30", label: "16 a 30 dias", min: 16, max: 30 },
  { chave: "31-60", label: "31 a 60 dias", min: 31, max: 60 },
  { chave: "60+", label: "Mais de 60 dias", min: 61, max: Infinity },
] as const;

export function diasEmAtraso(vencimento: string, hojeIso: string): number {
  const msPorDia = 24 * 60 * 60 * 1000;
  const dVenc = new Date(vencimento + "T00:00:00Z").getTime();
  const dHoje = new Date(hojeIso + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((dHoje - dVenc) / msPorDia));
}
