// Motor de otimização de abastecimento — porta fiel de _otimizar_rota_v3()
// do app interno em Streamlit (estudo_de_rede.py). Dado um conjunto de
// postos candidatos ao longo de uma rota e os dados do veículo, decide ONDE
// parar para abastecer e QUANTOS litros colocar em cada parada, usando um
// algoritmo guloso com "olhar à frente" (look-ahead).

export type CandidatoAbastecimento = {
  cnpj: string;
  km: number; // posição do posto na rota, a partir da origem (km)
  desvioKm: number; // distância do posto até a rota mais próxima (km)
  preco: number; // preço do combustível escolhido, nesse posto
  grade?: "A" | "B" | "C" | "D";
  label: string;
  lat: number;
  lon: number;
  bandeira?: string | null;
  uf?: string | null;
  // Fase 27.140 — "proprio" (postos_gf do cliente, preço negociado/importado)
  // ou "anp" (base pública nacional, preço é a estimativa oficial ANP) — só
  // informativo pra UI, não entra em nenhum peso/cálculo aqui.
  origem?: "proprio" | "anp";
};

export type ParadaSugerida = CandidatoAbastecimento & {
  // Fase Seleção-Manual-de-Postos (28/07/2026) — "manual" identifica uma
  // parada que o PRÓPRIO gestor escolheu clicando no posto (ver
  // calcularAbastecimentoParaSelecao mais abaixo), não uma decisão do
  // algoritmo guloso.
  motivo: "otimizado" | "estrategico" | "emergencia" | "manual";
  fuelChegadaL: number;
  pctChegada: number;
  litrosSugeridos: number;
  custoAbastecimento: number;
  fuelAposL: number;
  pctApos: number;
  metricaValor: number;
};

export type PesosOtimizacao = { preco: number; score: number; desvio: number };

const GRADE_PESO: Record<string, number> = { A: 1.0, B: 0.75, C: 0.5, D: 0.25 };

// Nível mínimo de segurança no tanque: nunca planeja deixar o tanque abaixo
// disso (25% da capacidade).
const NIVEL_MINIMO_PCT = 0.25;
// Fase corrige-minimas-paradas (27/07/2026, bug reportado pelo Daniel: numa
// rota de 3834,8 km, o perfil "Mínimas Paradas" sugeriu só 4 paradas
// somando 26L/R$168 — um caminhão não anda 3800km com 26L). Reserva menor
// específica desse perfil (10% em vez de 25%) — ele tolera rodar o tanque
// mais perto do vazio antes de exigir parada, o que aumenta o alcance
// efetivo por tanque e reduz o número de vezes que precisa parar (ver
// comentário mais abaixo sobre o que estava errado no cálculo de litros).
const NIVEL_MINIMO_PCT_MINIMAS_PARADAS = 0.1;
// Abaixo de 65% do tanque + posto não é mais barato que o último → não vale
// parar de novo (evita paradas desnecessárias).
const PCT_BAIXO = 0.65;
// Vantagem mínima de preço (3%) para "esticar" até um posto mais à frente.
const VANTAGEM_PRECO_MINIMA = 0.03;
// Vantagem mínima de métrica (5%) para considerar o posto mais à frente
// melhor o suficiente para justificar o desvio adicional.
const VANTAGEM_METRICA_MINIMA = 1.05;
const LITROS_MINIMOS = 5;

export function otimizarAbastecimento(params: {
  candidatos: CandidatoAbastecimento[];
  capacidadeTanqueL: number; // rcap
  autonomiaKmPorL: number; // raut
  distanciaTotalRotaKm: number; // rd
  pesos: PesosOtimizacao; // devem somar 1.0
  fillMode?: "normal" | "minimo";
  combustivelInicialL?: number; // padrão: tanque cheio
  maxParadas?: number;
}): ParadaSugerida[] {
  const {
    candidatos,
    capacidadeTanqueL: rcap,
    autonomiaKmPorL: raut,
    distanciaTotalRotaKm: rd,
    pesos,
    fillMode = "normal",
    combustivelInicialL,
    maxParadas = 30,
  } = params;

  if (candidatos.length === 0 || raut <= 0 || rcap <= 0) return [];

  const rmin = rcap * (fillMode === "minimo" ? NIVEL_MINIMO_PCT_MINIMAS_PARADAS : NIVEL_MINIMO_PCT);
  const alcanceEfetivoKm = (rcap - rmin) * raut;

  const precos = candidatos.map((c) => c.preco).filter((p) => Number.isFinite(p));
  const pmin = precos.length ? Math.min(...precos) : 0;
  const pmax = precos.length ? Math.max(...precos) : 1;

  function metrica(c: CandidatoAbastecimento): number {
    const p = 1 - (c.preco - pmin) / Math.max(pmax - pmin, 0.01);
    const g = GRADE_PESO[c.grade ?? "D"] ?? 0.25;
    const d = 1 - Math.min(c.desvioKm / 5, 1);
    return pesos.preco * p + pesos.score * g + pesos.desvio * d;
  }

  const paradas: ParadaSugerida[] = [];
  let pos = 0;
  let fuel = combustivelInicialL ?? rcap;
  const vistos = new Set<string>();
  let ultimoPreco: number | null = null;

  for (let iter = 0; iter < maxParadas; iter++) {
    if (pos >= rd) break;

    const podeIr = (fuel - rmin) * raut;
    const alcancaSem = pos + podeIr;
    if (alcancaSem >= rd) break; // chega ao destino sem precisar parar

    const janela = candidatos.filter((c) => pos < c.km && c.km <= alcancaSem && !vistos.has(c.cnpj));
    const janelaEstendida = candidatos.filter(
      (c) => alcancaSem < c.km && c.km <= pos + alcanceEfetivoKm * 1.85 && !vistos.has(c.cnpj)
    );

    let best: CandidatoAbastecimento;
    let motivo: ParadaSugerida["motivo"];
    let fillAlvoKm: number | null = null;

    if (janela.length === 0) {
      const alemDoAlcance = candidatos
        .filter((c) => c.km > pos && !vistos.has(c.cnpj))
        .sort((a, b) => a.km - b.km);
      if (alemDoAlcance.length === 0) break; // sem tanque para chegar em nenhum posto restante
      best = alemDoAlcance[0];
      motivo = "emergencia";
    } else {
      const bestObrigatorio = janela.reduce((m, c) => (metrica(c) > metrica(m) ? c : m));
      if (janelaEstendida.length > 0) {
        const bestEstendido = janelaEstendida.reduce((m, c) => (metrica(c) > metrica(m) ? c : m));
        if (
          metrica(bestEstendido) > metrica(bestObrigatorio) * VANTAGEM_METRICA_MINIMA &&
          bestEstendido.preco < bestObrigatorio.preco * (1 - VANTAGEM_PRECO_MINIMA)
        ) {
          fillAlvoKm = bestEstendido.km;
        }
      }
      best = bestObrigatorio;
      motivo = fillAlvoKm ? "estrategico" : "otimizado";
    }

    const kmAte = best.km - pos;
    const fuelChegada = Math.max(0, fuel - kmAte / raut);
    const pctChegada = (fuelChegada / rcap) * 100;

    // Tanque ainda alto e posto não compensa em relação ao último → pula
    // sem gastar tempo aqui (segue viagem sem abastecer).
    if (
      motivo !== "emergencia" &&
      pctChegada >= PCT_BAIXO * 100 &&
      ultimoPreco !== null &&
      best.preco >= ultimoPreco * (1 - VANTAGEM_PRECO_MINIMA) &&
      !fillAlvoKm
    ) {
      pos = best.km;
      fuel = fuelChegada;
      vistos.add(best.cnpj);
      continue;
    }

    const distRestante = rd - best.km;
    let litrosNecessarios: number;

    // Fase corrige-minimas-paradas — o "minimo" ANTES mirava só na
    // distância até o próximo posto candidato (não no quanto o tanque
    // aguenta), o que faz o oposto do pretendido: com postos espaçados,
    // vira parada curta e frequente, e em rotas longas o algoritmo podia
    // nem chegar ao destino (batia no limite de `maxParadas` no meio do
    // caminho, sem avisar). Corrigido: "Mínimas Paradas" agora enche o
    // tanque igual aos outros perfis (reaproveita a mesma lógica abaixo) —
    // a diferença que efetivamente reduz o número de paradas é a reserva
    // menor (`NIVEL_MINIMO_PCT_MINIMAS_PARADAS`), que aumenta o alcance por
    // tanque.
    if (fillAlvoKm) {
      const distAlvo = fillAlvoKm - best.km;
      litrosNecessarios = (distAlvo / raut) * 1.1 + rmin - fuelChegada;
    } else if (distRestante <= alcanceEfetivoKm) {
      litrosNecessarios = (distRestante / raut) * 1.15 + rmin - fuelChegada;
    } else {
      litrosNecessarios = rcap - fuelChegada;
    }

    let litrosFill = Math.max(0, litrosNecessarios);
    litrosFill = Math.min(litrosFill, rcap - fuelChegada);
    litrosFill = Math.ceil(litrosFill);

    if (litrosFill < LITROS_MINIMOS) {
      pos = best.km;
      fuel = fuelChegada;
      vistos.add(best.cnpj);
      continue;
    }

    const fuelApos = Math.min(fuelChegada + litrosFill, rcap);
    const pctApos = (fuelApos / rcap) * 100;
    const custoAbastecimento = Math.round(litrosFill * best.preco * 100) / 100;

    paradas.push({
      ...best,
      motivo,
      fuelChegadaL: Math.round(fuelChegada * 10) / 10,
      pctChegada: Math.round(pctChegada * 10) / 10,
      litrosSugeridos: litrosFill,
      custoAbastecimento,
      fuelAposL: Math.round(fuelApos * 10) / 10,
      pctApos: Math.round(pctApos * 10) / 10,
      metricaValor: Math.round(metrica(best) * 1000) / 1000,
    });

    vistos.add(best.cnpj);
    ultimoPreco = best.preco;
    fuel = fuelApos;
    pos = best.km;
  }

  return paradas;
}

// Fase Seleção-Manual-de-Postos (28/07/2026) — pedido de um gestor de frota
// (via Daniel): depois de traçar a rota, ele quer VER os postos do corredor e
// escolher com o próprio dedo em quais o motorista vai abastecer, em vez de
// só confiar cegamente no algoritmo guloso acima. Esta função é a irmã mais
// simples de otimizarAbastecimento: o gestor já decidiu ONDE parar (a lista
// `candidatosSelecionados`, em qualquer ordem de clique) — aqui só resta
// decidir QUANTO abastecer em cada parada, na ordem real da estrada (por
// km), reaproveitando a mesma conta de "litros necessários pra cobrir até a
// próxima parada com margem de segurança" do algoritmo automático. Usada
// tanto para o gestor ajustar a sugestão do Roteirizador Inteligente (parte
// de resultado.candidatos que ele desmarcou/marcou) quanto para o modo
// 100% manual (Por Rota), que começa com nenhuma parada selecionada.
//
// Roda inteiramente no client (sem chamada ao servidor) — pura o bastante
// pra recalcular a cada clique sem esperar round-trip nenhum.
export type ResultadoSelecaoManual = {
  paradas: ParadaSugerida[];
  // Mensagens de trechos onde o tanque não é suficiente pra cobrir a
  // distância até a próxima parada selecionada (ou até o destino, na última
  // perna) — nunca bloqueia a seleção, só avisa o gestor pra ele decidir se
  // quer adicionar mais um posto naquele trecho.
  alertas: string[];
};

export function calcularAbastecimentoParaSelecao(params: {
  candidatosSelecionados: CandidatoAbastecimento[];
  capacidadeTanqueL: number;
  autonomiaKmPorL: number;
  distanciaTotalRotaKm: number;
  combustivelInicialL?: number;
}): ResultadoSelecaoManual {
  const {
    candidatosSelecionados,
    capacidadeTanqueL: rcap,
    autonomiaKmPorL: raut,
    distanciaTotalRotaKm: rd,
    combustivelInicialL,
  } = params;

  const alertas: string[] = [];
  if (raut <= 0 || rcap <= 0) return { paradas: [], alertas };

  const rmin = rcap * NIVEL_MINIMO_PCT;
  const ordenados = [...candidatosSelecionados].sort((a, b) => a.km - b.km);

  const paradas: ParadaSugerida[] = [];
  let pos = 0;
  let fuel = combustivelInicialL ?? rcap;

  for (let i = 0; i < ordenados.length; i++) {
    const candidato = ordenados[i];
    const kmAte = candidato.km - pos;
    const fuelChegadaBruto = fuel - kmAte / raut;

    if (fuelChegadaBruto < 0) {
      const faltamKm = Math.round(-fuelChegadaBruto * raut);
      alertas.push(
        `De ${i === 0 ? "origem" : ordenados[i - 1].label} até ${candidato.label} (${kmAte.toFixed(0)} km), o tanque não é suficiente — faltariam ${faltamKm} km de autonomia. Considere adicionar um posto no meio ou revisar a ordem.`
      );
    }

    const fuelChegada = Math.max(0, fuelChegadaBruto);
    const pctChegada = (fuelChegada / rcap) * 100;

    const proximoKm = i < ordenados.length - 1 ? ordenados[i + 1].km : rd;
    const distProxima = proximoKm - candidato.km;
    const litrosNecessarios = (distProxima / raut) * 1.15 + rmin - fuelChegada;

    let litrosFill = Math.max(0, litrosNecessarios);
    litrosFill = Math.min(litrosFill, rcap - fuelChegada);
    litrosFill = Math.ceil(litrosFill);

    const fuelApos = Math.min(fuelChegada + litrosFill, rcap);
    const pctApos = (fuelApos / rcap) * 100;
    const custoAbastecimento = Math.round(litrosFill * candidato.preco * 100) / 100;

    paradas.push({
      ...candidato,
      motivo: "manual",
      fuelChegadaL: Math.round(fuelChegada * 10) / 10,
      pctChegada: Math.round(pctChegada * 10) / 10,
      litrosSugeridos: litrosFill,
      custoAbastecimento,
      fuelAposL: Math.round(fuelApos * 10) / 10,
      pctApos: Math.round(pctApos * 10) / 10,
      metricaValor: 0,
    });

    pos = candidato.km;
    fuel = fuelApos;
  }

  // Última perna: da última parada selecionada (ou da origem, se nenhuma
  // foi escolhida) até o destino.
  const distFinal = rd - pos;
  const fuelFinal = fuel - distFinal / raut;
  if (fuelFinal < 0) {
    const faltamKm = Math.round(-fuelFinal * raut);
    const origemTrecho = ordenados.length > 0 ? ordenados[ordenados.length - 1].label : "origem";
    alertas.push(
      `De ${origemTrecho} até o destino (${distFinal.toFixed(0)} km), o tanque não é suficiente — faltariam ${faltamKm} km de autonomia.`
    );
  }

  return { paradas, alertas };
}
