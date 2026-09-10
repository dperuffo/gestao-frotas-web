"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { RelatorioExecutivo as RelatorioExecutivoType } from "./RelatorioExecutivo";

// Fase Pente-Fino-Performance (10/09/2026, item 1.2) — este componente usa
// recharts mas só é mostrado quando sua aba está ativa (AbasPainel só monta
// a aba selecionada), então não precisa entrar no bundle inicial da rota.
const RelatorioExecutivo = dynamic(() => import("./RelatorioExecutivo").then((m) => m.RelatorioExecutivo), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function RelatorioExecutivoLazy(props: ComponentProps<typeof RelatorioExecutivoType>) {
  return <RelatorioExecutivo {...props} />;
}
