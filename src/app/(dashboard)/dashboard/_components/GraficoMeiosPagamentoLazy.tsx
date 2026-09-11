"use client";

import dynamic from "next/dynamic";
import type { FatiaPagamento } from "./GraficoMeiosPagamento";

const GraficoMeiosPagamento = dynamic(
  () => import("./GraficoMeiosPagamento").then((m) => m.GraficoMeiosPagamento),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoMeiosPagamentoLazy({ dados }: { dados: FatiaPagamento[] }) {
  return <GraficoMeiosPagamento dados={dados} />;
}
