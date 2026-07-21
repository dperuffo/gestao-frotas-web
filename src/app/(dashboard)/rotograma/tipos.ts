// Rotograma de Segurança — tipos e constantes compartilhadas entre o
// formulário, a visualização e a exportação em PDF.
//
// Inspirado no mockup "Rotograma de Segurança" da landing page de marketing
// da ferramenta de referência (nunca foi implementado de fato lá, só existia
// como wireframe): mapa de pontos de risco e paradas ao longo de uma viagem,
// mais um bloco fixo de contatos de emergência, exportável em PDF para o
// motorista levar na estrada.
//
// riscos/paradas são guardados como jsonb (arrays de objetos abaixo) na
// coluna correspondente da tabela `rotogramas`.

export type CategoriaRisco = "perigo" | "crime" | "radar";
export type CategoriaParada = "abastecimento" | "alimentacao" | "pernoite" | "pedagio";

export type RotogramaRisco = {
  local: string; // ex.: "BR-381 km 120 — Itatiaia/MG"
  categoria: CategoriaRisco;
  descricao: string; // ex.: "Área de perigo · Vel. máx 60 km/h"
  km?: number | null; // posição na rota, usada na linha do tempo (tela + PDF)
};

export type RotogramaParada = {
  local: string; // ex.: "Posto Ipiranga — km 210"
  categoria: CategoriaParada;
  descricao: string; // ex.: "Abastecimento · R$ 6,05/L · 24h"
  km?: number | null; // posição na rota, usada na linha do tempo (tela + PDF)
};

export const CATEGORIAS_RISCO: { valor: CategoriaRisco; label: string; icone: string }[] = [
  { valor: "perigo", label: "Área de perigo", icone: "⚠️" },
  { valor: "crime", label: "Zona de crime", icone: "🚨" },
  { valor: "radar", label: "Lombada / Radar", icone: "📸" },
];

export const CATEGORIAS_PARADA: { valor: CategoriaParada; label: string; icone: string }[] = [
  { valor: "abastecimento", label: "Abastecimento", icone: "⛽" },
  { valor: "alimentacao", label: "Alimentação", icone: "🍽️" },
  { valor: "pernoite", label: "Pernoite", icone: "🛏️" },
  // Fase Pedágios — pedido do Daniel: praças de pedágio também aparecendo
  // na linha do tempo do Rotograma (mesmo emoji 🎫 usado no mapa da
  // Roteirização, ver iconePedagio em roteirizacao/_components/MapaRota.tsx).
  { valor: "pedagio", label: "Pedágio", icone: "🎫" },
];

export const CORES_RISCO: Record<CategoriaRisco, { bg: string; text: string; border: string; dot: string }> = {
  perigo: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  crime: { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", dot: "bg-rose-700" },
  radar: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
};

export const CORES_PARADA: { bg: string; text: string; border: string; dot: string } = {
  bg: "bg-cyan-50",
  text: "text-cyan-700",
  border: "border-cyan-200",
  dot: "bg-cyan-500",
};

export type ContatoEmergencia = { nome: string; numero: string };

// Números nacionais fixos (Brasil) — não dependem de cadastro do usuário.
export const CONTATOS_EMERGENCIA: ContatoEmergencia[] = [
  { nome: "PRF", numero: "191" },
  { nome: "SAMU", numero: "192" },
  { nome: "Bombeiros", numero: "193" },
  { nome: "PM", numero: "190" },
  { nome: "ANTT", numero: "166" },
];

export function categoriaRiscoLabel(c: CategoriaRisco): string {
  return CATEGORIAS_RISCO.find((x) => x.valor === c)?.label ?? c;
}

export function categoriaParadaLabel(c: CategoriaParada): string {
  return CATEGORIAS_PARADA.find((x) => x.valor === c)?.label ?? c;
}

// Tenta extrair um número de km do texto livre de "local" (ex.: "BR-153 -
// KM 100", "BR-381 km 120 — Itatiaia/MG") — usada como fallback pra
// posicionar na linha do tempo itens criados antes do campo "km" existir
// ou cadastrados sem preencher esse campo.
export function extrairKmDoLocal(local: string): number | null {
  const m = local.match(/km\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const valor = Number(m[1].replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

export type PontoLinhaDoTempo = {
  tipo: "risco" | "parada";
  local: string;
  descricao: string;
  categoria: CategoriaRisco | CategoriaParada;
  km: number; // sempre resolvido (explícito, extraído do texto, ou posição relativa)
  kmEstimado: boolean; // true quando "km" não veio do campo explícito nem do texto
};

// Resolve a posição (km) de cada risco/parada pra montar a linha do tempo:
// 1) campo "km" explícito, se preenchido; 2) senão, tenta extrair do texto
// de "local"; 3) senão, distribui uniformemente pela ordem de cadastro
// (fallback pra nunca deixar um ponto de fora do gráfico).
export function resolverLinhaDoTempo(riscos: RotogramaRisco[], paradas: RotogramaParada[]): PontoLinhaDoTempo[] {
  const todos = [
    ...riscos.map((r) => ({ ...r, tipo: "risco" as const })),
    ...paradas.map((p) => ({ ...p, tipo: "parada" as const })),
  ];
  if (todos.length === 0) return [];

  const kmConhecidos = todos
    .map((item) => item.km ?? extrairKmDoLocal(item.local))
    .filter((km): km is number => km !== null);
  const kmMaximoConhecido = kmConhecidos.length > 0 ? Math.max(...kmConhecidos) : 100;

  return todos
    .map((item, i) => {
      const kmExplicito = item.km ?? extrairKmDoLocal(item.local);
      const km = kmExplicito ?? ((i + 1) / (todos.length + 1)) * kmMaximoConhecido;
      return {
        tipo: item.tipo,
        local: item.local,
        descricao: item.descricao,
        categoria: item.categoria,
        km,
        kmEstimado: kmExplicito === null,
      };
    })
    .sort((a, b) => a.km - b.km);
}
