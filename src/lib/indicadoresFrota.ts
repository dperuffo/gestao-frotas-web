// Fase Indicadores-da-Frota D (30/07/2026) — pedido do Daniel: "colocar um
// filtro de seleção do veículo... escolher o veículo específico ou todos,
// ou também poder comparar veículos entre si... indicadores distintos por
// modelo, tipo de veículo". Este módulo tem o tipo de retorno da RPC
// kpis_frota_por_veiculo e a função que reagrega uma lista de veículos (por
// exemplo, filtrados por modelo/tipo) nos MESMOS 8 KPIs — usada quando o
// usuário filtra um subconjunto da frota em vez de "Todos" (que usa direto
// kpis_frota_resumo, testada contra dado real) ou um veículo específico
// (que usa a linha individual sem reagregação).
export type VeiculoKpi = {
  placa: string;
  marca: string | null;
  modelo: string | null;
  tipo_veiculo: string | null;
  tipo: string | null;
  classificacao: string | null;
  centro_custo_nome: string | null;
  dias_periodo: number;
  dias_parado: number;
  disponibilidade_pct: number | null;
  km_periodo: number;
  custo_operacional_total: number;
  cpk_operacional: number | null;
  litros: number;
  media_km_l: number | null;
  dias_disponivel: number;
  dias_com_movimento: number;
  utilizacao_pct: number | null;
  manutencao_preventiva_custo: number;
  manutencao_corretiva_custo: number;
  manutencao_nao_classificada_custo: number;
  pct_corretiva: number | null;
  itens_inspecionados: number;
  itens_conformes: number;
  conformidade_pct: number | null;
  tmrnc_horas: number | null;
  total_sinistros: number;
};

// Forma unificada usada pelos cards da tela — tanto o agregado da frota
// inteira (kpis_frota_resumo) quanto um veículo específico ou um grupo
// reagregado (agregarVeiculos) se encaixam aqui.
export type KpisExibicao = {
  totalVeiculos: number;
  diasPeriodo: number;
  disponibilidadePct: number | null;
  cpkOperacional: number | null;
  mediaKmL: number | null;
  utilizacaoPct: number | null;
  pctCorretiva: number | null;
  manutencaoNaoClassificadaCusto: number;
  conformidadePct: number | null;
  itensInspecionados: number;
  tmrncHoras: number | null;
  totalSinistros: number;
  indiceSinistralidade: number | null;
};

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

// Reagrega uma lista de veículos (ex.: resultado de filtrar por modelo ou
// tipo_veiculo) nos mesmos 8 KPIs, usando as MESMAS fórmulas ponderadas da
// RPC kpis_frota_resumo (soma de numerador/denominador, não média simples
// de percentuais — uma média simples de "utilização%" por veículo distorce
// o resultado quando os veículos têm quilometragem/dias muito diferentes).
// Exceção: TMRNC é uma média simples dos tmrnc_horas já calculados por
// veículo (não dá pra reconstruir o peso exato — horas por pendência — só
// com o valor agregado por veículo); aceitável como aproximação porque o
// TMRNC já é, em si, uma média.
export function agregarVeiculos(veiculos: VeiculoKpi[], diasPeriodo: number): KpisExibicao {
  const totalVeiculos = veiculos.length;
  const somar = (fn: (v: VeiculoKpi) => number) => veiculos.reduce((s, v) => s + fn(v), 0);

  const diasParadoTotal = somar((v) => v.dias_parado);
  const kmTotal = somar((v) => v.km_periodo);
  const custoTotal = somar((v) => v.custo_operacional_total);
  const litrosTotal = somar((v) => v.litros);
  const diasDisponivelTotal = somar((v) => v.dias_disponivel);
  const diasComMovimentoTotal = somar((v) => v.dias_com_movimento);
  const custoPreventiva = somar((v) => v.manutencao_preventiva_custo);
  const custoCorretiva = somar((v) => v.manutencao_corretiva_custo);
  const custoNaoClassificada = somar((v) => v.manutencao_nao_classificada_custo);
  const itensInspecionados = somar((v) => v.itens_inspecionados);
  const itensConformes = somar((v) => v.itens_conformes);
  const totalSinistros = somar((v) => v.total_sinistros);

  const tmrncValores = veiculos.map((v) => v.tmrnc_horas).filter((v): v is number => v !== null);

  return {
    totalVeiculos,
    diasPeriodo,
    disponibilidadePct:
      totalVeiculos > 0 && diasPeriodo > 0
        ? arredondar(Math.max(0, Math.min(100, (1 - diasParadoTotal / (totalVeiculos * diasPeriodo)) * 100)), 1)
        : null,
    cpkOperacional: kmTotal > 0 ? arredondar(custoTotal / kmTotal, 3) : null,
    mediaKmL: litrosTotal > 0 ? arredondar(kmTotal / litrosTotal, 2) : null,
    utilizacaoPct: diasDisponivelTotal > 0 ? arredondar(Math.min(100, (diasComMovimentoTotal / diasDisponivelTotal) * 100), 1) : null,
    pctCorretiva: custoPreventiva + custoCorretiva > 0 ? arredondar((custoCorretiva / (custoPreventiva + custoCorretiva)) * 100, 1) : null,
    manutencaoNaoClassificadaCusto: custoNaoClassificada,
    conformidadePct: itensInspecionados > 0 ? arredondar((itensConformes / itensInspecionados) * 100, 1) : null,
    itensInspecionados,
    tmrncHoras: tmrncValores.length > 0 ? arredondar(tmrncValores.reduce((s, v) => s + v, 0) / tmrncValores.length, 1) : null,
    totalSinistros,
    indiceSinistralidade: totalVeiculos > 0 ? arredondar((totalSinistros / totalVeiculos) * 100, 1) : null,
  };
}

// Um único veículo também vira KpisExibicao — mesma forma, sem sinistralidade
// percentual (não faz sentido pra n=1, ver comentário na migração da RPC).
export function veiculoParaExibicao(v: VeiculoKpi): KpisExibicao {
  return {
    totalVeiculos: 1,
    diasPeriodo: v.dias_periodo,
    disponibilidadePct: v.disponibilidade_pct,
    cpkOperacional: v.cpk_operacional,
    mediaKmL: v.media_km_l,
    utilizacaoPct: v.utilizacao_pct,
    pctCorretiva: v.pct_corretiva,
    manutencaoNaoClassificadaCusto: v.manutencao_nao_classificada_custo,
    conformidadePct: v.conformidade_pct,
    itensInspecionados: v.itens_inspecionados,
    tmrncHoras: v.tmrnc_horas,
    totalSinistros: v.total_sinistros,
    indiceSinistralidade: null,
  };
}
