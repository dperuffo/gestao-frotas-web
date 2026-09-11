"use client";

import dynamic from "next/dynamic";
import type { PontoPrevisaoConsumo } from "./GraficoPrevisaoConsumo";

const GraficoPrevisaoConsumo = dynamic(
  () => import("./GraficoPrevisaoConsumo").then((m) => m.GraficoPrevisaoConsumo),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoPrevisaoConsumoLazy({ dados }: { dados: PontoPrevisaoConsumo[] }) {
  return <GraficoPrevisaoConsumo dados={dados} />;
}
