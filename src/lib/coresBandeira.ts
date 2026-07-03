import { normalizarTexto } from "./utils";

// Cores de marcador disponíveis no mapa. As 3 primeiras são reservadas para
// as grandes distribuidoras pedidas explicitamente; o resto forma a
// paleta usada (por hash estável) pras demais bandeiras.
export const CORES_MARCADOR = [
  "amarelo",
  "vermelho",
  "verde",
  "azul",
  "roxo",
  "rosa",
  "marrom",
  "ciano",
  "laranja",
  "cinza",
] as const;
export type CorMarcador = (typeof CORES_MARCADOR)[number];

export const CORES_HEX: Record<CorMarcador, string> = {
  amarelo: "#eab308",
  vermelho: "#dc2626",
  verde: "#16a34a",
  azul: "#2563eb",
  roxo: "#7c3aed",
  rosa: "#db2777",
  marrom: "#92400e",
  ciano: "#0891b2",
  laranja: "#ea580c",
  cinza: "#64748b",
};

// Bandeiras/distribuidoras com cor fixa pedida pelo Daniel — checadas por
// palavra-chave (sem acento, maiúscula) porque o texto de "bandeira" vem da
// planilha de carga e varia (ex: "Ipiranga", "REDE IPIRANGA").
const CORES_FIXAS: { padrao: RegExp; cor: CorMarcador }[] = [
  { padrao: /IPIRANGA/, cor: "amarelo" },
  { padrao: /SHELL|RAIZEN/, cor: "vermelho" },
  { padrao: /PETROBRAS|VIBRA|\bBR\b/, cor: "verde" },
];

// Paleta usada por hash pras bandeiras sem cor fixa — cinza fica de fora
// (reservado pra "sem bandeira") pra sobrar mais variedade nas demais.
const PALETA_OUTRAS: CorMarcador[] = ["azul", "roxo", "rosa", "marrom", "ciano", "laranja"];

// Resolve a cor do marcador a partir da bandeira/distribuidora do posto.
// Mesma bandeira sempre cai na mesma cor (hash estável), então o mapa fica
// consistente entre uma consulta e outra.
export function corPorBandeira(bandeira: string | null | undefined): CorMarcador {
  const nome = normalizarTexto(bandeira ?? "");
  if (!nome) return "cinza";

  for (const { padrao, cor } of CORES_FIXAS) {
    if (padrao.test(nome)) return cor;
  }

  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return PALETA_OUTRAS[hash % PALETA_OUTRAS.length];
}
