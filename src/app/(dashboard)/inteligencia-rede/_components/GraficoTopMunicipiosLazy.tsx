"use client";

import dynamic from "next/dynamic";
import type { ItemTopMunicipio } from "./GraficoTopMunicipios";

const GraficoTopMunicipios = dynamic(
  () => import("./GraficoTopMunicipios").then((m) => m.GraficoTopMunicipios),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoTopMunicipiosLazy({ dados }: { dados: ItemTopMunicipio[] }) {
  return <GraficoTopMunicipios dados={dados} />;
}
