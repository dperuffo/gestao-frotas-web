"use client";

import dynamic from "next/dynamic";
import type { ItemOportunidade } from "./GraficoOportunidadesExpansao";

const GraficoOportunidadesExpansao = dynamic(
  () => import("./GraficoOportunidadesExpansao").then((m) => m.GraficoOportunidadesExpansao),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[340px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoOportunidadesExpansaoLazy({ dados }: { dados: ItemOportunidade[] }) {
  return <GraficoOportunidadesExpansao dados={dados} />;
}
