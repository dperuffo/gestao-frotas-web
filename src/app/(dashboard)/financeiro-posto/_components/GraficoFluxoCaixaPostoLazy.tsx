"use client";

import dynamic from "next/dynamic";
import type { PontoFluxoCaixaPosto } from "./GraficoFluxoCaixaPosto";
export type { PontoFluxoCaixaPosto };

const GraficoFluxoCaixaPosto = dynamic(
  () => import("./GraficoFluxoCaixaPosto").then((m) => m.GraficoFluxoCaixaPosto),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoFluxoCaixaPostoLazy({ dados }: { dados: PontoFluxoCaixaPosto[] }) {
  return <GraficoFluxoCaixaPosto dados={dados} />;
}
