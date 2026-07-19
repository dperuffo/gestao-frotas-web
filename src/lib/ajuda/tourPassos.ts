export type PassoTour = { alvo: string; titulo: string; texto: string };

// Fase 24 — tour de boas-vindas, disparado no primeiro acesso (ver
// TourProvider) e reaberto a qualquer momento pela Central de Ajuda. Fica
// restrito à barra lateral (sempre visível, em qualquer tela) pra não
// depender de qual página o usuário está vendo quando o tour começa —
// cada passo aponta pra um elemento marcado com data-tour="<alvo>" no
// layout do dashboard.
//
// Fase 27.82 — achado real (reportado pelo Daniel): até aqui só existia UM
// array de passos, mostrado pra todo mundo — inclusive perfil "posto"
// (segmento Revenda), cujo menu (menuPosto em layout.tsx) é uma trilha bem
// mais enxuta e diferente da de Frota (sem Cadastros/Operação/Assistente).
// Os passos "menu-cadastros"/"menu-operacao"/"menu-assistente" apontavam
// pra elementos que nem existem na tela do posto (sem data-tour
// correspondente), então o tour ficava incoerente com as funções reais
// dele. Agora existem dois arrays — PASSOS_TOUR_FROTA (cliente/admin/
// gestor_frota/analista, o de sempre) e PASSOS_TOUR_POSTO (revenda) — e
// TourProvider recebe qual usar via prop `passos`, escolhida em
// layout.tsx a partir de `ehPosto`.
export const PASSOS_TOUR_FROTA: PassoTour[] = [
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
    texto: "Abastecimentos, roteirização inteligente, rotogramas, manutenção preditiva, relatórios e integrações com outros sistemas. Também é aqui que fica Fretes — contrate frete pra rede toda negociar (estilo Uber) ou atribua direto a um motorista próprio ou parceiro, com adiantamento configurável na aceitação.",
  },
  // Fase 27.114 — pedido do Daniel: "Ajustar Central de Ajuda e Permissoes
  // com as novas abas no menu para todas as visoes". A seção Administração
  // (Fase 27.110: só admin vê) nunca teve passo no tour. Como só existe
  // um array pro lado Frota inteiro (admin + gestor_frota + analista) e
  // menu-administracao não existe no DOM pra quem não é admin, layout.tsx
  // filtra este passo fora do array antes de passar pro TourProvider quando
  // `!ehAdmin` (mesmo espírito da Fase 27.82: nunca apontar pra um alvo que
  // não existe na tela de quem está vendo o tour).
  {
    alvo: "menu-administracao",
    titulo: "Administração",
    texto: "Área exclusiva do time FNI: permissões por perfil, inteligência de rede, assinaturas e avaliações de todos os clientes, e configurações globais do sistema.",
  },
  {
    alvo: "central-ajuda",
    titulo: "Precisa de ajuda depois?",
    texto: "Clique aqui a qualquer momento pra rever este tour. E fique de olho no ícone (?) ao lado dos indicadores e painéis pela plataforma — ele explica o que cada número significa e como é calculado.",
  },
];

// Fase 27.82 — tour do perfil "posto" (segmento Revenda): menu próprio,
// bem mais enxuto que o de Frota (menuPosto em layout.tsx) — nada de
// Cadastros/Operação/Assistente/Roteirização. Cada alvo aponta pro
// data-tour correspondente nos itens de menuPosto.
export const PASSOS_TOUR_POSTO: PassoTour[] = [
  {
    alvo: "logo",
    titulo: "Bem-vindo(a) à FNI Gestão de Frotas!",
    texto: "Vamos fazer um tour rápido pelas funções do seu posto na plataforma. Leva menos de um minuto — e você pode rever isso quando quiser.",
  },
  {
    alvo: "menu-dashboard-posto",
    titulo: "Dashboard",
    texto: "Visão geral do seu posto: abastecimentos registrados, negociações em andamento e indicadores de vendas.",
  },
  {
    alvo: "menu-negociacoes-posto",
    titulo: "Negociações",
    texto: "Aqui você recebe, aceita, recusa ou contrapropõe negociações de fornecimento de combustível com clientes de frota — preço, volume mínimo mensal e vigência.",
  },
  {
    alvo: "menu-clientes-posto",
    titulo: "Clientes",
    texto: "Lista de todos os clientes que já negociaram com o seu posto, com o ciclo de abastecimento e pagamento combinado com cada um.",
  },
  {
    alvo: "menu-precos-posto",
    titulo: "Meus Preços",
    texto: "Cadastre e atualize os preços dos combustíveis que você vende — é o que aparece pros clientes de frota na hora de negociar.",
  },
  {
    alvo: "menu-financeiro-posto",
    titulo: "Financeiro",
    texto: "Faturas emitidas pros seus clientes (a receber), despesas do posto (a pagar) e o fluxo de caixa previsto, dia a dia.",
  },
  {
    alvo: "menu-integracoes-posto",
    titulo: "Integrações",
    texto: "Gere sua chave de API pra conectar o sistema do seu posto direto à plataforma — negociações e preços sem precisar acessar aqui toda vez.",
  },
  {
    alvo: "central-ajuda",
    titulo: "Precisa de ajuda depois?",
    texto: "Clique aqui a qualquer momento pra rever este tour. E fique de olho no ícone (?) ao lado dos indicadores e painéis pela plataforma — ele explica o que cada número significa e como é calculado.",
  },
];
