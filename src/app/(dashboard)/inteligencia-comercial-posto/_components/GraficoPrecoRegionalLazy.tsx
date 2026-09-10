"use client";

import dynamic from "next/dynamic";
import type { ItemPrecoRegional } from "./GraficoPrecoRegional";
export type { ItemPrecoRegional };

const GraficoPrecoRegional = dynamic(() => import("./GraficoPrecoRegional").then((m) => m.GraficoPrecoRegional), {
  ssr: false,
  loading: () => (
    <div className="flex h-[160px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoPrecoRegionalLazy({ dados }: { dados: ItemPrecoRegional[] }) {
  return <GraficoPrecoRegional dados={dados} />;
}
