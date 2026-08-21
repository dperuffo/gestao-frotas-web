"use client";

import dynamic from "next/dynamic";
import type { PontoJornada } from "./GraficoHorasDirigidas";
export type { PontoJornada };

const GraficoHorasDirigidas = dynamic(
  () => import("./GraficoHorasDirigidas").then((m) => m.GraficoHorasDirigidas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoHorasDirigidasLazy({ dados }: { dados: PontoJornada[] }) {
  return <GraficoHorasDirigidas dados={dados} />;
}
