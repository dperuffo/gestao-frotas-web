// Fase Indicadores-da-Frota — Checklist de Inspeção Veicular (30/07/2026).
// Lista fixa de itens de segurança/documentação verificados a cada
// inspeção — mesmo espírito de ITENS_MANUTENCAO (manutencaoPreditiva.ts),
// texto livre salvo em inspecoes_veiculos_itens.item, sem tabela separada
// de catálogo (não há necessidade de customização por empresa ainda).
export const ITENS_INSPECAO = [
  "Pneus",
  "Freios",
  "Luzes",
  "Óleo e fluidos",
  "Cintos de segurança",
  "Extintor de incêndio",
  "Documentação (CRLV)",
  "Retrovisores",
  "Buzina",
  "Limpador de para-brisa",
  "Estepe",
  "Triângulo e macaco",
] as const;

// Itens de segurança crítica — referência do artigo/benchmark: "freios ou
// pneus com problema" merecem resolução em horas, não em dias. Por ora só
// marca visualmente (badge); não há SLA automático de cobrança ainda.
export const ITENS_CRITICOS: readonly string[] = ["Pneus", "Freios"];

export const TIPOS_SINISTRO = ["Colisão", "Furto/Roubo", "Incêndio", "Avaria", "Outro"] as const;
export type TipoSinistro = (typeof TIPOS_SINISTRO)[number];

export const GRAVIDADES_SINISTRO = ["Leve", "Moderada", "Grave"] as const;
export type GravidadeSinistro = (typeof GRAVIDADES_SINISTRO)[number];
