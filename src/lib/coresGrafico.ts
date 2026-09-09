// Fase Design-ProFrotas-Divergencias (09/09/2026) — troca do acento taupe
// (#B38B6D, tema Swiss Minimalism) pelo laranja do novo tema (#de6024, HTML
// de referência do relatório de divergências ProFrotas). Mesmo papel de
// sempre (acento do tema, mesma cor do botão primário e do item ativo do
// menu) — só o valor muda. Série principal também migra do azul genérico
// pro slate do novo tema, pra combinar com o header/cards.
//
// Cores semânticas (status ativo/atenção/inativo, verde "a receber" vs
// vermelho "a pagar", etc.) continuam definidas localmente em cada
// gráfico — este arquivo é só pra série "neutra"/categórica sem
// significado semântico próprio.
export const CORES_GRAFICO = {
  /** Linha de grade do CartesianGrid — cinza bem claro, igual em todo o app. */
  grade: "#e2e8f0",
  /** Série principal — slate do novo tema (mesma cor de título/header). */
  primaria: "#4e5d77",
  /** Acento do tema (mesmo laranja do botão primário e do item ativo do menu). */
  acento: "#de6024",
  /** Série secundária/neutra — substitui o antigo #8C8C8C. */
  neutro: "#94A3B8",
  /** Paleta categórica compartilhada, pra gráficos com 3+ séries sem cor semântica fixa. */
  serie: ["#4e5d77", "#de6024", "#94A3B8", "#4db956", "#e0a020", "#7C3AED"] as const,
};
