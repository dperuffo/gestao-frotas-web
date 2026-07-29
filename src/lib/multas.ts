// Fase Onda-2 (benchmark TicketLog, item #4) — Gestão de Multas: rótulos e
// cores compartilhados entre lista, detalhe e formulário.
export const STATUS_MULTA_LABEL: Record<string, string> = {
  pendente_indicacao: "Pendente de indicação",
  indicada: "Condutor indicado",
  paga: "Paga",
  recorrida: "Recorrida",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export const STATUS_MULTA_COR: Record<string, string> = {
  pendente_indicacao: "bg-amber-100 text-amber-800",
  indicada: "bg-blue-100 text-blue-800",
  paga: "bg-green-100 text-green-800",
  recorrida: "bg-purple-100 text-purple-800",
  vencida: "bg-red-100 text-red-800",
  cancelada: "bg-slate-100 text-slate-600",
};

export const GRAVIDADE_MULTA_LABEL: Record<string, string> = {
  leve: "Leve",
  media: "Média",
  grave: "Grave",
  gravissima: "Gravíssima",
};

export const GRAVIDADE_MULTA_COR: Record<string, string> = {
  leve: "bg-slate-100 text-slate-700",
  media: "bg-amber-100 text-amber-700",
  grave: "bg-orange-100 text-orange-700",
  gravissima: "bg-red-100 text-red-700",
};
