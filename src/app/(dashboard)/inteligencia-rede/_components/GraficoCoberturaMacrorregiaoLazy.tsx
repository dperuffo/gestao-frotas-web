"use client";

import dynamic from "next/dynamic";
import type { ItemCoberturaRegiao } from "./GraficoCoberturaMacrorregiao";

const GraficoCoberturaMacrorregiao = dynamic(
  () => import("./GraficoCoberturaMacrorregiao").then((m) => m.GraficoCoberturaMacrorregiao),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoCoberturaMacrorregiaoLazy({ dados }: { dados: ItemCoberturaRegiao[] }) {
  return <GraficoCoberturaMacrorregiao dados={dados} />;
}
