"use client";

import dynamic from "next/dynamic";
import type { PontoPrecoMedio } from "./GraficoEvolucaoPrecoMedio";

const GraficoEvolucaoPrecoMedio = dynamic(
  () => import("./GraficoEvolucaoPrecoMedio").then((m) => m.GraficoEvolucaoPrecoMedio),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoEvolucaoPrecoMedioLazy({ dados }: { dados: PontoPrecoMedio[] }) {
  return <GraficoEvolucaoPrecoMedio dados={dados} />;
}
