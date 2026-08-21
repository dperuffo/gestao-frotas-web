"use client";

import dynamic from "next/dynamic";
import type { PontoFinanceiro } from "./GraficoEvolucaoFinanceira";
export type { PontoFinanceiro };

const GraficoEvolucaoFinanceira = dynamic(
  () => import("./GraficoEvolucaoFinanceira").then((m) => m.GraficoEvolucaoFinanceira),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoEvolucaoFinanceiraLazy({ dados }: { dados: PontoFinanceiro[] }) {
  return <GraficoEvolucaoFinanceira dados={dados} />;
}
