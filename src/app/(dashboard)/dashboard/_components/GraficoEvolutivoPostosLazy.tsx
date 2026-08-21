"use client";

import dynamic from "next/dynamic";
import type { PontoEvolutivoPostos } from "./GraficoEvolutivoPostos";
export type { PontoEvolutivoPostos };

const GraficoEvolutivoPostos = dynamic(
  () => import("./GraficoEvolutivoPostos").then((m) => m.GraficoEvolutivoPostos),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoEvolutivoPostosLazy({
  dados,
  postos,
}: {
  dados: PontoEvolutivoPostos[];
  postos: string[];
}) {
  return <GraficoEvolutivoPostos dados={dados} postos={postos} />;
}
