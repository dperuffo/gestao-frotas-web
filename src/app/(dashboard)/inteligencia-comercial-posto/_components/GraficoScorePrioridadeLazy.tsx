"use client";

import dynamic from "next/dynamic";
import type { ItemScoreCliente } from "./GraficoScorePrioridade";
export type { ItemScoreCliente };

const GraficoScorePrioridade = dynamic(() => import("./GraficoScorePrioridade").then((m) => m.GraficoScorePrioridade), {
  ssr: false,
  loading: () => (
    <div className="flex h-[160px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoScorePrioridadeLazy({ dados }: { dados: ItemScoreCliente[] }) {
  return <GraficoScorePrioridade dados={dados} />;
}
