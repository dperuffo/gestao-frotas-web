// Fase Onda-2 (benchmark TicketLog, item #5) — Rede de Oficinas
// Credenciadas: rótulos/cores compartilhados, e a lista fixa de
// especialidades usada tanto no cadastro (admin) quanto no filtro (cliente).
export const ESPECIALIDADES_OFICINA = [
  "Mecânica geral",
  "Elétrica",
  "Funilaria/Pintura",
  "Pneus/Alinhamento",
  "Ar-condicionado",
  "Freios",
  "Suspensão",
  "Diesel/Injeção eletrônica",
  "Troca de óleo",
  "Socorro 24h",
] as const;

export const STATUS_ORCAMENTO_LABEL: Record<string, string> = {
  solicitado: "Aguardando retorno",
  respondido: "Orçamento recebido",
  aceito: "Aceito",
  recusado: "Recusado",
};

export const STATUS_ORCAMENTO_COR: Record<string, string> = {
  solicitado: "bg-amber-100 text-amber-800",
  respondido: "bg-blue-100 text-blue-800",
  aceito: "bg-green-100 text-green-800",
  recusado: "bg-slate-100 text-slate-600",
};
