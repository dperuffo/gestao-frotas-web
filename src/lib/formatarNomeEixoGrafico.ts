// Nomes de pessoas/empresas/postos em eixos categóricos de BarChart
// (layout="vertical") podem ser longos (ex.: "Marcos Vinicius Drago
// Fidelis", "Posto Rede Ipiranga Centro"). Como o eixo Y tem largura fixa,
// abreviamos pro primeiro + último "nome" (ou cortamos por tamanho) pra
// sempre caber numa única linha, sem quebrar e sobrepor a categoria
// vizinha. O texto original continua disponível no tooltip via
// labelFormatter, que recebe o valor cru do dataKey (não o tick
// formatado).
//
// Extraído do padrão aplicado primeiro em GraficoFidelidade.tsx
// (fidelidade-motoristas) e reaproveitado nos demais gráficos de barra
// horizontal com eixo categórico de texto variável.
export function formatarNomeEixoGrafico(nome: string, max = 20) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const curto = partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : nome;
  return curto.length > max ? `${curto.slice(0, max - 1)}…` : curto;
}
