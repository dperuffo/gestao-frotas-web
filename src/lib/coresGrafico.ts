// Fase Paleta-Clara (04/09/2026, pedido do Daniel: "cores de gráficos
// ficaram muito pesadas para a visão do usuário") — até aqui cada
// Grafico*.tsx (recharts) declarava sua própria paleta na mão, e boa parte
// reaproveitava #262626 (quase preto) como cor da série principal, o que
// reforçava visualmente o peso do tema escuro mesmo depois do menu/botão
// terem ficado mais claros. Este arquivo centraliza a paleta "padrão" dos
// gráficos — série principal em azul, acento taupe (mesmo do tema), cinza
// neutro — pra qualquer gráfico novo importar em vez de inventar cor nova,
// e pros gráficos existentes foram migrados aqui trocarem o #262626 por
// `CORES_GRAFICO.primaria`.
//
// Cores semânticas (status ativo/atenção/inativo, verde "a receber" vs
// vermelho "a pagar", etc.) continuam definidas localmente em cada
// gráfico — este arquivo é só pra série "neutra"/categórica sem
// significado semântico próprio.
export const CORES_GRAFICO = {
  /** Linha de grade do CartesianGrid — cinza bem claro, igual em todo o app. */
  grade: "#e2e8f0",
  /** Série principal — substitui o antigo #262626 (quase preto). */
  primaria: "#378ADD",
  /** Acento do tema (mesmo taupe do botão primário e do item ativo do menu). */
  acento: "#B38B6D",
  /** Série secundária/neutra — substitui o antigo #8C8C8C. */
  neutro: "#94A3B8",
  /** Paleta categórica compartilhada, pra gráficos com 3+ séries sem cor semântica fixa. */
  serie: ["#378ADD", "#B38B6D", "#94A3B8", "#16A34A", "#F59E0B", "#7C3AED"] as const,
};
