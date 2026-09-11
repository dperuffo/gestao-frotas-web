"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { PerformancePorPosto as PerformancePorPostoType } from "./PerformancePorPosto";

// Fase Pente-Fino-Performance (10/09/2026, item 1.2) — este componente usa
// recharts mas só é mostrado quando sua aba está ativa (AbasPainel só monta
// a aba selecionada), então não precisa entrar no bundle inicial da rota.
const PerformancePorPosto = dynamic(() => import("./PerformancePorPosto").then((m) => m.PerformancePorPosto), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function PerformancePorPostoLazy(props: ComponentProps<typeof PerformancePorPostoType>) {
  return <PerformancePorPosto {...props} />;
}
