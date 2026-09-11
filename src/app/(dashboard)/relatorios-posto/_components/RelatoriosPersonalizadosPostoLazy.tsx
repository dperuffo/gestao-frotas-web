"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { RelatoriosPersonalizadosPosto as RelatoriosPersonalizadosPostoType } from "./RelatoriosPersonalizadosPosto";

// Fase Pente-Fino-Performance (10/09/2026, item 1.2) — mesmo padrão aplicado
// à versão cliente (RelatoriosPersonalizadosLazy): componente grande, com
// recharts, carregado sob demanda em vez de entrar no bundle inicial da rota.
const RelatoriosPersonalizadosPosto = dynamic(
  () => import("./RelatoriosPersonalizadosPosto").then((m) => m.RelatoriosPersonalizadosPosto),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function RelatoriosPersonalizadosPostoLazy(
  props: ComponentProps<typeof RelatoriosPersonalizadosPostoType>
) {
  return <RelatoriosPersonalizadosPosto {...props} />;
}
