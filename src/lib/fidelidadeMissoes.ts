// Catálogo de métricas/ícones disponíveis pra uma missão de gamificação do
// programa "Estrada que Cuida" (Fase 17/07-4) — pedido do Daniel: "quero que
// o cliente tenha uma tela para criar mais missões, para que ele se engaje
// mais". Lista fechada de métricas (não dá pra deixar o gestor escrever
// regra livre com segurança) — cada uma corresponde a um CASE já
// implementado na RPC avaliar_missoes_motorista() do banco. Chaves de ícone
// batem 1:1 com o mapa iconesMissao em
// estrada-que-cuida/lib/features/gamificacao/providers/missoes_provider.dart
// — mudar aqui sem mudar lá faz o app cair no ícone padrão.

export const METRICAS_MISSAO = [
  {
    valor: "abastecimentos_confirmados",
    label: "Abastecimentos confirmados",
    descricao: "Quantidade total de abastecimentos que o motorista confirmou no app.",
    binaria: false,
  },
  {
    valor: "sequencia_dias",
    label: "Sequência de dias seguidos abastecendo",
    descricao: "Maior sequência de dias corridos com pelo menos 1 abastecimento confirmado.",
    binaria: false,
  },
  {
    valor: "dias_adesao",
    label: "Dias de adesão ao programa",
    descricao: "Quantos dias o motorista já está aderido ao programa de fidelidade.",
    binaria: false,
  },
  {
    valor: "fretes_concluidos",
    label: "Fretes concluídos",
    descricao: "Quantidade de fretes que o motorista concluiu com sucesso.",
    binaria: false,
  },
  {
    valor: "avaliacoes_recebidas",
    label: "Avaliações recebidas do cliente",
    descricao: "Quantidade de avaliações que o motorista recebeu do cliente ao concluir fretes.",
    binaria: false,
  },
  {
    valor: "resgates_beneficios",
    label: "Benefícios resgatados",
    descricao: "Quantidade de itens do catálogo de fidelidade (posto ou parceiro local) que o motorista resgatou.",
    binaria: false,
  },
  {
    valor: "seguranca_2fa_ativo",
    label: "Verificação em duas etapas ativada",
    descricao: "Motorista ativou a verificação em duas etapas (2FA) na tela de Segurança.",
    binaria: true,
  },
  {
    valor: "dependente_adicionado",
    label: "Dependente adicionado (conta família)",
    descricao: "Motorista cadastrou pelo menos 1 dependente na Conta Família.",
    binaria: true,
  },
  {
    valor: "rotas_calculadas",
    label: "Rotas calculadas na Roteirização",
    descricao: "Quantidade de vezes que o motorista calculou uma rota na Roteirização inteligente.",
    binaria: false,
  },
  {
    valor: "avaliacao_frete_enviada",
    label: "Avaliações enviadas sobre o cliente",
    descricao: "Quantidade de fretes concluídos em que o motorista avaliou o cliente.",
    binaria: false,
  },
  {
    valor: "saldo_pontos",
    label: "Saldo de pontos acumulado",
    descricao: "Total de pontos que o motorista já acumulou no programa (útil pra premiar quem chega perto do próximo nível).",
    binaria: false,
  },
] as const;

export type MetricaMissao = (typeof METRICAS_MISSAO)[number]["valor"];

export function eMetricaValida(v: string): v is MetricaMissao {
  return (METRICAS_MISSAO as readonly { valor: string }[]).some((m) => m.valor === v);
}

export function metricaEhBinaria(v: string): boolean {
  return METRICAS_MISSAO.find((m) => m.valor === v)?.binaria ?? false;
}

export const LABEL_METRICA_MISSAO: Record<string, string> = Object.fromEntries(
  METRICAS_MISSAO.map((m) => [m.valor, m.label])
);

// Ícones disponíveis pro seletor — cada chave precisa existir no mapa
// iconesMissao do app Flutter (ver comentário acima).
export const ICONES_MISSAO = [
  { valor: "flag_outlined", label: "🚩 Bandeira" },
  { valor: "emoji_flags_outlined", label: "🏁 Largada" },
  { valor: "local_gas_station_outlined", label: "⛽ Posto" },
  { valor: "calendar_month_outlined", label: "📅 Calendário" },
  { valor: "local_fire_department_outlined", label: "🔥 Sequência" },
  { valor: "local_shipping_outlined", label: "🚚 Caminhão" },
  { valor: "star_outline", label: "⭐ Estrela" },
  { valor: "card_giftcard_outlined", label: "🎁 Presente" },
  { valor: "security", label: "🔒 Segurança" },
  { valor: "family_restroom", label: "👨‍👩‍👧 Família" },
  { valor: "alt_route", label: "🗺️ Rota" },
  { valor: "emoji_events_outlined", label: "🏆 Troféu" },
  { valor: "thumb_up_outlined", label: "👍 Aprovação" },
  { valor: "verified_outlined", label: "✅ Verificado" },
  { valor: "route_outlined", label: "🛣️ Trajeto" },
  { valor: "groups_outlined", label: "👥 Grupo" },
  { valor: "payments_outlined", label: "💰 Pagamento" },
  { valor: "military_tech_outlined", label: "🎖️ Medalha" },
] as const;

export function eIconeValido(v: string): boolean {
  return (ICONES_MISSAO as readonly { valor: string }[]).some((i) => i.valor === v);
}
