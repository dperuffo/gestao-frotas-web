"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { EvolucaoTemporal as EvolucaoTemporalType } from "./EvolucaoTemporal";

// Fase Pente-Fino-Performance (10/09/2026, item 1.2) — completando a
// cobertura do lazy-loading de gráficos: este componente usa recharts mas
// só é mostrado quando sua aba está ativa (AbasPainel só monta a aba
// selecionada), então não precisa entrar no bundle inicial da rota. Usa
// `ComponentProps<typeof X>` em vez de repetir o tipo das props manualmente
// — evita divergir se o componente original mudar de assinatura.
const EvolucaoTemporal = dynamic(() => import("./EvolucaoTemporal").then((m) => m.EvolucaoTemporal), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function EvolucaoTemporalLazy(props: ComponentProps<typeof EvolucaoTemporalType>) {
  return <EvolucaoTemporal {...props} />;
}
