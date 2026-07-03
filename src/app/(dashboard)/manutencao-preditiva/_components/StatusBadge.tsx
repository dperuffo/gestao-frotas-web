import { COR_STATUS, LABEL_STATUS, type StatusManutencao } from "@/lib/manutencaoPreditiva";

export function StatusBadge({ status }: { status: StatusManutencao }) {
  const cor = COR_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cor.fundo} ${cor.texto} ${cor.borda}`}
    >
      {status === "critico" ? "🔴" : status === "alerta" ? "🟡" : "🟢"} {LABEL_STATUS[status]}
    </span>
  );
}
