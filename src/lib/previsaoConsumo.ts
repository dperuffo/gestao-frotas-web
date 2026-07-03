// Projeta o consumo (litros) dos dias restantes do mês selecionado,
// calibrando pela sazonalidade de dia da semana (ex: fins de semana
// costumam ter bem menos abastecimento que dias úteis) em vez de uma
// média simples "linear" — evita subestimar/superestimar dependendo de
// que dias da semana já ocorreram até agora no mês.
//
// Modelo: fator[dow] = média histórica daquele dia da semana / média geral
// de todos os dias da semana (histórico de ~90 dias). A "taxa-base" diária
// é uma mistura (shrinkage, Fase 27.23) entre a taxa calibrada só com os
// dias já ocorridos no mês e a média histórica geral — com peso crescente
// pros dias reais conforme o mês avança, pra não deixar 1-2 dias fora do
// padrão logo no início do mês distorcerem a projeção inteira (ver
// comentário mais abaixo, em cima do cálculo de `baseline`). Cada dia
// futuro recebe baseline * fator[dow daquele dia] — um ajuste
// multiplicativo simples de sazonalidade (method of moments), fácil de
// explicar e auditar.
export type PontoPrevisaoConsumo = {
  diaLabel: string;
  litros: number;
  tipo: "real" | "projetado";
};

export function calcularPrevisaoConsumo(params: {
  diasReais: Map<number, number>; // dia do mês (1-31) -> litros
  padraoDiaSemana: Record<number, number>; // 0(domingo)..6(sábado) -> média de litros/dia
  ano: number;
  mes: number; // 1-12
  diasNoMes: number;
  diaAtual: number; // último dia já ocorrido (= diasNoMes se o mês já terminou)
  projetarRestante: boolean;
}): PontoPrevisaoConsumo[] {
  const { diasReais, padraoDiaSemana, ano, mes, diasNoMes, diaAtual, projetarRestante } = params;

  const diaDaSemana = (dia: number) => new Date(ano, mes - 1, dia).getDay();
  const mediaGeral = Object.values(padraoDiaSemana).reduce((s, v) => s + v, 0) / 7 || 1;
  const fator = (dow: number) => (padraoDiaSemana[dow] ?? mediaGeral) / mediaGeral || 1;

  // Fase 27.23 — achado real: calibrar a taxa-base só com os dias já reais
  // do mês deixa a projeção do mês inteiro refém de um único dia fora do
  // padrão logo no início (ex.: um abastecimento pontual bem acima do
  // normal numa quinta-feira, com só 3 dias de mês decorridos, chegou a
  // inflar a taxa-base em ~50% em relação ao que ela seria sem esse dia).
  // Correção: suaviza (shrinkage) a taxa-base calculada a partir dos dias
  // reais (`baselineReal`) com a média histórica geral de 90 dias
  // (`mediaGeral` — o mesmo valor que, sozinho, já reproduz exatamente o
  // padrão por dia da semana quando não há nenhum dia real ainda). O peso
  // dado aos dias reais cresce conforme mais dias do mês se acumulam
  // (peso = diaAtual / (diaAtual + K)) — no início do mês a projeção confia
  // mais no histórico; depois de K dias reais, real e histórico pesam
  // igual; com bastante dias decorridos, a projeção passa a refletir quase
  // só a tendência real do mês. K=5 é um valor moderado (não ajustado só
  // pra esse caso específico) — dá pra recalibrar se, na prática, a
  // projeção ainda reagir demais/de menos a poucos dias de dado real.
  const K_SUAVIZACAO_DIAS = 5;
  let baseline = mediaGeral;
  if (projetarRestante && diaAtual < diasNoMes) {
    let somaReal = 0;
    let somaFatores = 0;
    for (let dia = 1; dia <= diaAtual; dia++) {
      somaReal += diasReais.get(dia) ?? 0;
      somaFatores += fator(diaDaSemana(dia));
    }
    if (somaFatores > 0 && diaAtual > 0) {
      const baselineReal = somaReal / somaFatores;
      const pesoReal = diaAtual / (diaAtual + K_SUAVIZACAO_DIAS);
      baseline = pesoReal * baselineReal + (1 - pesoReal) * mediaGeral;
    }
  }

  const pontos: PontoPrevisaoConsumo[] = [];
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const diaLabel = String(dia).padStart(2, "0");
    if (dia <= diaAtual) {
      pontos.push({ diaLabel, litros: Math.round((diasReais.get(dia) ?? 0) * 10) / 10, tipo: "real" });
    } else if (projetarRestante) {
      const projetado = baseline * fator(diaDaSemana(dia));
      pontos.push({ diaLabel, litros: Math.round(projetado * 10) / 10, tipo: "projetado" });
    }
  }
  return pontos;
}
