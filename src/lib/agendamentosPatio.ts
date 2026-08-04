// Fase agendamento-patio (04/08/2026, item 8 do benchmark FNI vs KMM,
// Grupo 2) — rótulos/cores compartilhados entre a tela de agenda
// (/agendamentos-patio) e o card dentro de /fretes/[id].
export const STATUS_AGENDAMENTO_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const STATUS_AGENDAMENTO_COR: Record<string, string> = {
  agendado: "bg-amber-100 text-amber-800",
  confirmado: "bg-blue-100 text-blue-800",
  em_andamento: "bg-violet-100 text-violet-800",
  concluido: "bg-green-100 text-green-800",
  cancelado: "bg-slate-100 text-slate-600",
};

export const TIPO_AGENDAMENTO_LABEL: Record<string, string> = {
  coleta: "Carga (coleta)",
  entrega: "Descarga (entrega)",
};
