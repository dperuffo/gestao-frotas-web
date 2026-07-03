// Gestão de Chamados (tickets) — tipos, constantes e helpers compartilhados
// entre a listagem, o detalhe e o formulário de criação. A tabela `tickets`
// já existia no banco (usada por uma ferramenta anterior, com 5 registros
// reais) — ver README "Fase 19" pra decisões de migração de schema.

export type TicketTipo = "incidente" | "melhoria";
export type TicketStatus = "aberto" | "em_analise" | "resolvido" | "fechado";
export type TicketPrioridade = "baixa" | "media" | "alta" | "critica";
export type AutorTipo = "usuario" | "admin";

export const TIPOS_TICKET: { valor: TicketTipo; label: string; icone: string }[] = [
  { valor: "incidente", label: "Incidente", icone: "🚨" },
  { valor: "melhoria", label: "Melhoria", icone: "💡" },
];

export const STATUS_TICKET: { valor: TicketStatus; label: string }[] = [
  { valor: "aberto", label: "Aberto" },
  { valor: "em_analise", label: "Em análise" },
  { valor: "resolvido", label: "Resolvido" },
  { valor: "fechado", label: "Fechado" },
];

export const PRIORIDADES_TICKET: { valor: TicketPrioridade; label: string }[] = [
  { valor: "baixa", label: "Baixa" },
  { valor: "media", label: "Média" },
  { valor: "alta", label: "Alta" },
  { valor: "critica", label: "Crítica" },
];

export const CORES_STATUS: Record<TicketStatus, { bg: string; text: string; border: string; dot: string }> = {
  aberto: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  em_analise: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  resolvido: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  fechado: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
};

export const CORES_PRIORIDADE: Record<TicketPrioridade, { bg: string; text: string; border: string }> = {
  baixa: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
  media: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  alta: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  critica: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

export function tipoLabel(t: TicketTipo): string {
  return TIPOS_TICKET.find((x) => x.valor === t)?.label ?? t;
}
export function statusLabel(s: TicketStatus): string {
  return STATUS_TICKET.find((x) => x.valor === s)?.label ?? s;
}
export function prioridadeLabel(p: TicketPrioridade): string {
  return PRIORIDADES_TICKET.find((x) => x.valor === p)?.label ?? p;
}

// Bucket privado do Storage onde os anexos de chamados são gravados —
// caminho de cada objeto segue o padrão "{ticket_id}/{timestamp}_{nome}".
export const BUCKET_ANEXOS = "ticket-anexos";

// Fase 27.22 — achado real: o crash genérico "Application error" ao anexar
// arquivo num chamado (visto de novo depois da Fase 27.18) não vinha de um
// erro tratável dentro da Server Action — as duas (criarChamadoAcao e
// enviarAnexoAcao) já tinham try/catch em volta do upload. O problema é
// anterior a isso: quando o arquivo passa do limite de corpo configurado
// pra Server Actions (25mb, ver next.config.mjs) — ou de qualquer limite
// imposto por um proxy no meio do caminho —, a própria chamada de rede da
// Server Action falha ANTES de a função no servidor rodar, e essa falha de
// transporte não é um "erro" normal devolvido pela action: ela escapa como
// exceção não tratada no componente cliente (ChamadoForm/ThreadChamado),
// que o Next só sabe mostrar como página de erro genérica. Por isso, além
// do try/catch em volta da chamada no cliente (defesa em profundidade),
// valida o tamanho ANTES de enviar — com folga em relação ao limite real,
// pra sobrar espaço pros outros campos do formulário multipart.
export const TAMANHO_MAX_ANEXO_BYTES = 20 * 1024 * 1024;

// Notificação visual: um chamado tem atualização "não vista" pra um papel
// (usuário do cliente ou admin da FNI) se foi atualizado depois da última
// vez que aquele papel visualizou/comentou nele. Ver colunas
// usuario_visto_em / admin_visto_em em `tickets`.
export function temAtualizacaoNaoVista(
  ticket: { atualizado_em: string | null; usuario_visto_em: string | null; admin_visto_em: string | null },
  papel: AutorTipo
): boolean {
  if (!ticket.atualizado_em) return false;
  const vistoEm = papel === "admin" ? ticket.admin_visto_em : ticket.usuario_visto_em;
  if (!vistoEm) return true;
  return new Date(ticket.atualizado_em).getTime() > new Date(vistoEm).getTime();
}

export function formatarTamanho(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
