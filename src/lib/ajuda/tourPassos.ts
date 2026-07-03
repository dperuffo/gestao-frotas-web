export type PassoTour = { alvo: string; titulo: string; texto: string };

// Fase 24 — tour de boas-vindas, disparado no primeiro acesso (ver
// TourProvider) e reaberto a qualquer momento pela Central de Ajuda. Fica
// restrito à barra lateral (sempre visível, em qualquer tela) pra não
// depender de qual página o usuário está vendo quando o tour começa —
// cada passo aponta pra um elemento marcado com data-tour="<alvo>" no
// layout do dashboard.
export const PASSOS_TOUR: PassoTour[] = [
  {
    alvo: "logo",
    titulo: "Bem-vindo(a) à FNI Gestão de Frotas!",
    texto: "Vamos fazer um tour rápido pelos principais recursos da plataforma. Leva menos de um minuto — e você pode rever isso quando quiser.",
  },
  {
    alvo: "menu-dashboard",
    titulo: "Dashboard",
    texto: "Visão geral da frota: custo total, custo por km, consumo, variação de preço contra a referência ANP, rankings de veículos/motoristas e alertas de manutenção.",
  },
  {
    alvo: "menu-financeiro",
    titulo: "Painel Financeiro",
    texto: "Orçamento planejado por categoria e centro de custo, custos fixos (seguro, IPVA, multas etc.) e a evolução do gasto mês a mês.",
  },
  {
    alvo: "menu-assistente",
    titulo: "Assistente FNI",
    texto: "Pergunte em português sobre os dados da sua frota — ele consulta o banco de dados pra você e responde na hora.",
  },
  {
    alvo: "menu-cadastros",
    titulo: "Cadastros",
    texto: "Aqui ficam os cadastros base: clientes, usuários, motoristas, veículos, centros de custo e postos revendedores.",
  },
  {
    alvo: "menu-operacao",
    titulo: "Operação",
    texto: "Abastecimentos, roteirização inteligente, rotogramas, manutenção preditiva, relatórios e integrações com outros sistemas.",
  },
  {
    alvo: "central-ajuda",
    titulo: "Precisa de ajuda depois?",
    texto: "Clique aqui a qualquer momento pra rever este tour. E fique de olho no ícone (?) ao lado dos indicadores e painéis pela plataforma — ele explica o que cada número significa e como é calculado.",
  },
];
