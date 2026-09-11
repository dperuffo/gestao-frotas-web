"use client";

import dynamic from "next/dynamic";
import type { ItemStatusChurn } from "./GraficoChurn";
export type { ItemStatusChurn };

const GraficoChurn = dynamic(() => import("./GraficoChurn").then((m) => m.GraficoChurn), {
  ssr: false,
  loading: () => (
    <div className="flex h-[160px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoChurnLazy({ dados }: { dados: ItemStatusChurn[] }) {
  return <GraficoChurn dados={dados} />;
}
