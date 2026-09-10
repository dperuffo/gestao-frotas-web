"use client";

import dynamic from "next/dynamic";
import type { ItemFugaRede } from "./GraficoFugaRede";
export type { ItemFugaRede };

const GraficoFugaRede = dynamic(() => import("./GraficoFugaRede").then((m) => m.GraficoFugaRede), {
  ssr: false,
  loading: () => (
    <div className="flex h-[200px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoFugaRedeLazy({ dados }: { dados: ItemFugaRede[] }) {
  return <GraficoFugaRede dados={dados} />;
}
