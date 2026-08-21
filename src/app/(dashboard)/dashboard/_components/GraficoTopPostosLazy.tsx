"use client";

import dynamic from "next/dynamic";
import type { PontoTopPosto } from "./GraficoTopPostos";

const GraficoTopPostos = dynamic(() => import("./GraficoTopPostos").then((m) => m.GraficoTopPostos), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoTopPostosLazy({ dados }: { dados: PontoTopPosto[] }) {
  return <GraficoTopPostos dados={dados} />;
}
