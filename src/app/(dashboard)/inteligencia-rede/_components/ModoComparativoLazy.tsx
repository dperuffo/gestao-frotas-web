"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ModoComparativo as ModoComparativoType } from "./ModoComparativo";

// Fase Pente-Fino-Performance (10/09/2026, item 1.2) — completando a
// cobertura do lazy-loading de gráficos: este componente usa recharts mas
// só é mostrado quando a aba "Modo Comparativo" está ativa (AbasPainel só
// monta a aba selecionada), então não precisa entrar no bundle inicial da
// rota. Usa `ComponentProps<typeof X>` em vez de repetir o tipo das props
// manualmente — evita divergir se o componente original mudar de assinatura.
const ModoComparativo = dynamic(() => import("./ModoComparativo").then((m) => m.ModoComparativo), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function ModoComparativoLazy(props: ComponentProps<typeof ModoComparativoType>) {
  return <ModoComparativo {...props} />;
}
