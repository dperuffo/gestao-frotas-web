// Projeta o consumo (litros) dos dias restantes do mês selecionado,
// calibrando pela sazonalidade de dia da semana (ex: fins de semana
// costumam ter bem menos abastecimento que dias úteis) em vez de uma
// média simples "linear" — evita subestimar/superestimar dependendo de
// que dias da semana já ocorreram até agora no mês.
//
// Modelo: fator[dow] = média histórica daquele dia da semana / média geral
// de todos os dias da semana (histórico de ~90 dias). A "taxa-base" diária
// é calibrada a partir dos dias já ocorridos no mês (dividindo o total
// real pela soma dos fatores desses dias), e cada dia futuro recebe
// baseline * fator[dow daquele dia] — um ajuste multiplicativo simples de
// sazonalidade (method of moments), fácil de explicar e auditar.
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

  let baseline = 0;
  if (projetarRestante && diaAtual < diasNoMes) {
    let somaReal = 0;
    let somaFatores = 0;
    for (let dia = 1; dia <= diaAtual; dia++) {
      somaReal += diasReais.get(dia) ?? 0;
      somaFatores += fator(diaDaSemana(dia));
    }
    baseline = somaFatores > 0 ? somaReal / somaFatores : 0;
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
