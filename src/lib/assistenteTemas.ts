// Conteúdo compartilhado do Assistente FNI: cartões por tema (tela inicial),
// sugestões de continuação e sugestão por tela (botão flutuante / Ctrl+K).
export type TemaAssistente = {
  id: string;
  titulo: string;
  perguntas: string[];
};

export const TEMAS_ASSISTENTE: TemaAssistente[] = [
  {
    id: "custos",
    titulo: "Custos",
    perguntas: [
      "Qual a previsão de custo com combustível da minha frota até o fim do mês?",
      "Mostre em gráfico o custo de combustível por mês nos últimos 6 meses",
      "Gasto por meio de pagamento (PróFrotas, PDV, outros) nos últimos 90 dias",
    ],
  },
  {
    id: "rotas",
    titulo: "Rotas e preços",
    perguntas: [
      "Qual o melhor posto para abastecer Diesel S-10 entre Curitiba e São Paulo?",
      "Mostre a variação de preço da Gasolina Comum entre Florianópolis e Porto Alegre",
    ],
  },
  {
    id: "veiculos",
    titulo: "Veículos e motoristas",
    perguntas: [
      "Quais os 10 veículos que mais gastaram com combustível este ano? (gráfico)",
      "Qual veículo está sem manutenção registrada há mais tempo?",
      "Quantos motoristas ativos temos por centro de custo?",
    ],
  },
  {
    id: "regras",
    titulo: "Regras e cadastros",
    perguntas: [
      "Parametrize os veículos da Fiat com consumo médio entre 9 e 12 km/l para autorizar o abastecimento",
    ],
  },
  {
    id: "operacao",
    titulo: "Multas, fretes e estoque",
    perguntas: [
      "Quais multas estão em aberto e quanto somam? Mostre por motorista",
      "Fretes por status neste ano, em gráfico",
      "Quais peças estão com estoque abaixo do mínimo?",
    ],
  },
  {
    id: "ajuda",
    titulo: "Como usar a FNI",
    perguntas: [
      "Como funciona a integração com o Pró-Frotas?",
      "O que preciso configurar pra abastecimentos aparecerem certo nos indicadores?",
    ],
  },
];

// Sugestões de continuação após uma resposta (genéricas, valem para qualquer tema).
export const CONTINUACOES_ASSISTENTE = [
  "Detalhe isso por veículo",
  "Compare com o período anterior",
  "Explique em poucas palavras o que mais chama atenção",
];

// Sugestão por tela: primeira rota que casar (prefixo) vence.
const SUGESTOES_POR_TELA: { prefixo: string; sugestao: string }[] = [
  { prefixo: "/dashboard", sugestao: "Quais veículos gastam acima da média este mês?" },
  { prefixo: "/abastecimentos", sugestao: "Gasto por meio de pagamento nos últimos 90 dias" },
  { prefixo: "/veiculos", sugestao: "Quais os 10 veículos que mais gastaram com combustível este ano?" },
  { prefixo: "/motoristas", sugestao: "Quantos motoristas ativos temos por centro de custo?" },
  { prefixo: "/multas", sugestao: "Quais multas estão em aberto e quanto somam? Mostre por motorista" },
  { prefixo: "/fretes", sugestao: "Fretes por status neste ano, em gráfico" },
  { prefixo: "/roteirizacao", sugestao: "Qual o melhor posto para abastecer Diesel S-10 entre Curitiba e São Paulo?" },
  { prefixo: "/parametros-uso", sugestao: "Parametrize os veículos da Fiat com consumo médio entre 9 e 12 km/l" },
  { prefixo: "/manutencao", sugestao: "Qual veículo está sem manutenção registrada há mais tempo?" },
  { prefixo: "/financeiro", sugestao: "Qual a previsão de custo com combustível até o fim do mês?" },
];

export function sugestaoParaTela(pathname: string): string {
  return (
    SUGESTOES_POR_TELA.find((s) => pathname === s.prefixo || pathname.startsWith(s.prefixo + "/"))?.sugestao ??
    "Qual a previsão de custo com combustível da minha frota até o fim do mês?"
  );
}

// Caminho que abre o Assistente já enviando uma pergunta.
export function caminhoAssistenteComPergunta(pergunta: string, empresaId?: string | null): string {
  const q = new URLSearchParams({ pergunta });
  if (empresaId) q.set("empresa", empresaId);
  return `/assistente?${q.toString()}`;
}
