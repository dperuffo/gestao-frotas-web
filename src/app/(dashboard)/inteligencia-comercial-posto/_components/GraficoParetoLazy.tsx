"use client";

import dynamic from "next/dynamic";
import type { ItemPareto } from "./GraficoPareto";
export type { ItemPareto };

const GraficoPareto = dynamic(() => import("./GraficoPareto").then((m) => m.GraficoPareto), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoParetoLazy({ dados }: { dados: ItemPareto[] }) {
  return <GraficoPareto dados={dados} />;
}
