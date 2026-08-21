"use client";

import dynamic from "next/dynamic";
import type { ItemCustoAnp } from "./GraficoCustoAnp";
export type { ItemCustoAnp };

const GraficoCustoAnp = dynamic(() => import("./GraficoCustoAnp").then((m) => m.GraficoCustoAnp), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoCustoAnpLazy({ dados }: { dados: ItemCustoAnp[] }) {
  return <GraficoCustoAnp dados={dados} />;
}
