// Fase P0.5 — motor de cálculo de frete rodoviário. Função pura (sem I/O),
// mesmo espírito de `montarPayload()` em planos-viagem/actions.ts: entrada
// tipada → saída tipada, fácil de testar unitariamente e reaproveitar tanto
// na simulação (/cotacoes) quanto, no futuro, num recálculo em lote.
//
// Composição clássica de uma tabela de frete rodoviário (frete-peso por
// faixa + adicionais + ICMS "por dentro"):
//   1. Frete-peso: max(peso_kg * valor_por_kg, valor_mínimo) da faixa que
//      contém o peso da carga.
//   2. Ad valorem: % sobre o valor da carga (NF) — cobre risco de avaria.
//   3. GRIS (Gerenciamento de Risco): % sobre o valor da carga — cobre roubo/
//      furto em rota, contratado à parte do seguro do embarcador.
//   4. TDE/TDA (Taxa de Desembaraço/Documental) e taxa de despacho: valores
//      fixos por operação.
//   5. Pedágio: valor fixo estimado da rota (o simulador pode alimentar isso
//      a partir do Roteirizador — ver src/lib/geo.ts — mas o motor aqui só
//      soma o que vier pronto, não recalcula rota).
//   6. ICMS "por dentro": o imposto compõe a própria base de cálculo (o
//      preço final já o contém), então não é uma soma simples — é um
//      gross-up: valor_total = subtotal / (1 - alíquota).

export type FaixaPesoFrete = {
  pesoMinKg: number;
  pesoMaxKg: number | null;
  valorPorKg: number;
  valorMinimo: number;
};

export type ItemComposicaoFrete = {
  codigo: "frete_peso" | "ad_valorem" | "gris" | "tde" | "tda" | "despacho" | "pedagio" | "icms";
  label: string;
  valor: number;
};

export type EntradaCalculoFrete = {
  pesoKg: number;
  valorCarga: number;
  faixas: FaixaPesoFrete[];
  percentualAdValorem: number;
  percentualGris: number;
  valorTde: number;
  valorTda: number;
  valorDespacho: number;
  valorPedagio: number;
  percentualIcms: number;
};

export type ResultadoCalculoFrete = {
  itens: ItemComposicaoFrete[];
  valorFretePeso: number;
  valorAdValorem: number;
  valorGris: number;
  valorTde: number;
  valorTda: number;
  valorDespacho: number;
  valorPedagio: number;
  subtotalAntesIcms: number;
  valorIcms: number;
  valorTotal: number;
  faixaUsada: FaixaPesoFrete | null;
};

// Escolhe a faixa de peso que contém `pesoKg`. Se o peso ultrapassar o teto
// de todas as faixas cadastradas, usa a faixa "aberta" (peso_max_kg null) se
// existir, senão a de maior peso_min_kg (a mais próxima disponível) — nunca
// retorna null quando há pelo menos uma faixa, pra não deixar a cotação sem
// frete-peso por um cadastro incompleto da tabela.
export function encontrarFaixaPeso(pesoKg: number, faixas: FaixaPesoFrete[]): FaixaPesoFrete | null {
  if (faixas.length === 0) return null;
  const exata = faixas.find((f) => pesoKg >= f.pesoMinKg && (f.pesoMaxKg === null || pesoKg <= f.pesoMaxKg));
  if (exata) return exata;
  const ordenadas = [...faixas].sort((a, b) => b.pesoMinKg - a.pesoMinKg);
  return ordenadas[0];
}

export function calcularFretePeso(pesoKg: number, faixa: FaixaPesoFrete | null): number {
  if (!faixa) return 0;
  return Math.max(pesoKg * faixa.valorPorKg, faixa.valorMinimo);
}

export function calcularFrete(entrada: EntradaCalculoFrete): ResultadoCalculoFrete {
  const faixaUsada = encontrarFaixaPeso(entrada.pesoKg, entrada.faixas);
  const valorFretePeso = calcularFretePeso(entrada.pesoKg, faixaUsada);
  const valorAdValorem = arredonda(entrada.valorCarga * (entrada.percentualAdValorem / 100));
  const valorGris = arredonda(entrada.valorCarga * (entrada.percentualGris / 100));
  const valorTde = entrada.valorTde;
  const valorTda = entrada.valorTda;
  const valorDespacho = entrada.valorDespacho;
  const valorPedagio = entrada.valorPedagio;

  const subtotalAntesIcms = arredonda(
    valorFretePeso + valorAdValorem + valorGris + valorTde + valorTda + valorDespacho + valorPedagio
  );

  const aliquota = entrada.percentualIcms / 100;
  const valorTotal = aliquota > 0 && aliquota < 1 ? arredonda(subtotalAntesIcms / (1 - aliquota)) : subtotalAntesIcms;
  const valorIcms = arredonda(valorTotal - subtotalAntesIcms);

  const itens: ItemComposicaoFrete[] = [
    { codigo: "frete_peso", label: "Frete-peso", valor: valorFretePeso },
    { codigo: "ad_valorem", label: `Ad valorem (${entrada.percentualAdValorem}%)`, valor: valorAdValorem },
    { codigo: "gris", label: `GRIS (${entrada.percentualGris}%)`, valor: valorGris },
    { codigo: "tde", label: "TDE", valor: valorTde },
    { codigo: "tda", label: "TDA", valor: valorTda },
    { codigo: "despacho", label: "Taxa de despacho", valor: valorDespacho },
    { codigo: "pedagio", label: "Pedágio", valor: valorPedagio },
    { codigo: "icms", label: `ICMS por dentro (${entrada.percentualIcms}%)`, valor: valorIcms },
  ];

  return {
    itens,
    valorFretePeso,
    valorAdValorem,
    valorGris,
    valorTde,
    valorTda,
    valorDespacho,
    valorPedagio,
    subtotalAntesIcms,
    valorIcms,
    valorTotal,
    faixaUsada,
  };
}

// Piso mínimo ANTT (Res. 5.867/2020): piso = distância * CCD (coeficiente de
// custo por deslocamento, R$/km) + CC (coeficiente de custo por carga e
// descarga, valor fixo por eixo/tipo de carga).
export function calcularPisoAntt(distanciaKm: number, piso: { coeficienteDeslocamento: number; coeficienteCargaDescarga: number }): number {
  return arredonda(distanciaKm * piso.coeficienteDeslocamento + piso.coeficienteCargaDescarga);
}

// true quando o frete cotado fica ABAIXO do piso mínimo — alerta de proteção
// legal (Lei do Motorista/Res. ANTT), não bloqueia a simulação.
export function verificarAlertaPiso(valorTotal: number, pisoMinimo: number | null): boolean {
  if (pisoMinimo === null) return false;
  return valorTotal < pisoMinimo;
}

function arredonda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
