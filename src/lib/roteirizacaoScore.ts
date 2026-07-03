// Score composto do posto (0-100) e perfis de peso para a Roteirização
// (Fase 7) — porta fiel das funções _calcular_score_posto() e
// _ESTRATEGIAS_DEF do app interno em Streamlit (estudo_de_rede.py).

import { haversineKm, type Ponto } from "./geo";

export type ScorePosto = {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D";
  scorePreco: number;
  scoreServicos: number;
  scoreDistancia: number;
  detalhePreco: string;
  detalheServicos: string;
  detalheDistancia: string;
};

// Pesos fixos do score: preço vs. referência ANP conta 50%, quantidade de
// serviços do posto conta 30%, proximidade de um ponto de referência conta
// 20%. Faixas de grau: A ≥ 75 · B ≥ 55 · C ≥ 35 · D < 35.
export function calcularScorePosto(params: {
  precoPosto?: number | null;
  precoReferenciaAnp?: number | null;
  posto?: Ponto | null;
  pontoReferencia?: Ponto | null;
  servicosAtivos: number;
  servicosTotal: number;
}): ScorePosto {
  const { precoPosto, precoReferenciaAnp, posto, pontoReferencia, servicosAtivos, servicosTotal } = params;

  // ── Preço (50%) ──────────────────────────────────────────────────
  let scorePreco = 50;
  let detalhePreco = "Sem referência ANP";
  if (precoReferenciaAnp && precoReferenciaAnp > 0 && precoPosto && precoPosto > 0) {
    const diff = (precoPosto - precoReferenciaAnp) / precoReferenciaAnp;
    scorePreco = Math.max(0, Math.min(100, 50 - diff * 500));
    detalhePreco = `${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}% vs ANP (${precoReferenciaAnp.toFixed(3)})`;
  }

  // ── Serviços (30%) ───────────────────────────────────────────────
  let scoreServicos = 0;
  let detalheServicos = "Sem dados de serviços";
  if (servicosTotal > 0) {
    scoreServicos = Math.min(100, (servicosAtivos / servicosTotal) * 100);
    detalheServicos = `${servicosAtivos}/${servicosTotal} serviços`;
  }

  // ── Distância (20%) ──────────────────────────────────────────────
  let scoreDistancia = 50;
  let detalheDistancia = "Sem ponto de referência";
  if (posto && pontoReferencia) {
    const dKm = haversineKm(posto, pontoReferencia);
    scoreDistancia = Math.max(0, Math.min(100, 100 - dKm));
    detalheDistancia = `${dKm.toFixed(1)} km do ponto de busca`;
  }

  const score = 0.5 * scorePreco + 0.3 * scoreServicos + 0.2 * scoreDistancia;
  const grade: ScorePosto["grade"] = score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";

  return {
    score: Math.round(score * 10) / 10,
    grade,
    scorePreco: Math.round(scorePreco * 10) / 10,
    scoreServicos: Math.round(scoreServicos * 10) / 10,
    scoreDistancia: Math.round(scoreDistancia * 10) / 10,
    detalhePreco,
    detalheServicos,
    detalheDistancia,
  };
}

export type PerfilPeso = {
  chave: string;
  nome: string;
  icone: string;
  preco: number;
  score: number;
  desvio: number;
  fillMode: "normal" | "minimo";
  descricao: string;
};

// Os 4 perfis de peso pré-definidos no Streamlit (_ESTRATEGIAS_DEF). O
// gestor de frota escolhe um perfil em vez de digitar pesos manualmente —
// mesma UX do app legado.
export const PERFIS_PESO: PerfilPeso[] = [
  {
    chave: "economia",
    nome: "Economia",
    icone: "💰",
    preco: 0.8,
    score: 0.1,
    desvio: 0.1,
    fillMode: "normal",
    descricao: "Minimiza custo total — prioriza sempre o posto mais barato.",
  },
  {
    chave: "equilibrio",
    nome: "Equilíbrio",
    icone: "⚖️",
    preco: 0.5,
    score: 0.3,
    desvio: 0.2,
    fillMode: "normal",
    descricao: "Pondera preço, qualidade do posto (score A-D) e distância da rota.",
  },
  {
    chave: "qualidade",
    nome: "Qualidade",
    icone: "⭐",
    preco: 0.3,
    score: 0.5,
    desvio: 0.2,
    fillMode: "normal",
    descricao: "Prioriza postos com score A e B — pode custar um pouco mais.",
  },
  {
    chave: "minimas_paradas",
    nome: "Mínimas Paradas",
    icone: "🛑",
    preco: 0.8,
    score: 0.1,
    desvio: 0.1,
    fillMode: "minimo",
    descricao: "Para o mínimo de vezes — abastece só o necessário a cada parada.",
  },
];

export const PERFIL_PADRAO = "equilibrio";
