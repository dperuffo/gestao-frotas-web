import type { LucideIcon } from "lucide-react";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

// Fase Dashboard-Redesign (12/08/2026) — pedido do Daniel: mais cor/ícone/
// interatividade nas telas, inspirado em apps de banco (ver benchmark de
// UX). Substitui o card branco único (usado em quase toda tela de
// indicador) por uma variante com cor de fundo leve + ícone por tipo, e um
// "delta" opcional (comparação com um período anterior). Extraído pra cá
// (compartilhado) depois de usado tanto no Dashboard quanto em Veículos —
// evita duplicar a mesma implementação em cada tela.
const CORES = {
  sky: { bg: "bg-sky-50", icone: "text-sky-700", numero: "text-sky-900", texto: "text-sky-700" },
  green: { bg: "bg-green-50", icone: "text-green-700", numero: "text-green-900", texto: "text-green-700" },
  amber: { bg: "bg-amber-50", icone: "text-amber-700", numero: "text-amber-900", texto: "text-amber-700" },
  red: { bg: "bg-red-50", icone: "text-red-700", numero: "text-red-900", texto: "text-red-700" },
  violet: { bg: "bg-violet-50", icone: "text-violet-700", numero: "text-violet-900", texto: "text-violet-700" },
} as const;

export type CorIndicador = keyof typeof CORES;

export function IndicadorColorido({
  label,
  valor,
  sub,
  delta,
  icon: Icon,
  cor,
  ajudaChave,
}: {
  label: string;
  valor: string;
  sub?: string;
  delta?: { texto: string; tom: "positivo" | "negativo" | "neutro" };
  icon: LucideIcon;
  cor: CorIndicador;
  ajudaChave?: string;
}) {
  const c = CORES[cor];
  const corDelta =
    delta?.tom === "positivo" ? "text-status-ativo" : delta?.tom === "negativo" ? "text-status-inativo" : c.texto;
  return (
    <div className={`rounded-xl p-4 ${c.bg}`}>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${c.icone}`} aria-hidden="true" />
        <p className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide ${c.texto}`}>
          {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
        </p>
      </div>
      <p className={`text-2xl font-semibold ${c.numero}`}>{valor}</p>
      {sub && <p className={`text-xs ${c.texto}`}>{sub}</p>}
      {delta && <p className={`text-xs font-medium ${corDelta}`}>{delta.texto}</p>}
    </div>
  );
}
