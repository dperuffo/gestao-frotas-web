"use client";

import dynamic from "next/dynamic";
import type { ItemSensibilidadePreco } from "./GraficoSensibilidadePreco";
export type { ItemSensibilidadePreco };

const GraficoSensibilidadePreco = dynamic(
  () => import("./GraficoSensibilidadePreco").then((m) => m.GraficoSensibilidadePreco),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  },
);

export default function GraficoSensibilidadePrecoLazy({ dados }: { dados: ItemSensibilidadePreco[] }) {
  return <GraficoSensibilidadePreco dados={dados} />;
}
