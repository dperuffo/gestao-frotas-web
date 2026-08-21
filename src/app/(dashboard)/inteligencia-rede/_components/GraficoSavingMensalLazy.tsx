"use client";

import dynamic from "next/dynamic";
import type { PontoEvolucaoMensal } from "./GraficoSavingMensal";

const GraficoSavingMensal = dynamic(
  () => import("./GraficoSavingMensal").then((m) => m.GraficoSavingMensal),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoSavingMensalLazy({
  dados,
  referencias,
}: {
  dados: PontoEvolucaoMensal[];
  referencias: Record<string, number>;
}) {
  return <GraficoSavingMensal dados={dados} referencias={referencias} />;
}
