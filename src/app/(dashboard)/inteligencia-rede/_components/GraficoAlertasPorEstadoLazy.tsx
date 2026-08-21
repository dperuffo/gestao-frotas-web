"use client";

import dynamic from "next/dynamic";
import type { ItemAlertaEstado } from "./GraficoAlertasPorEstado";
export type { ItemAlertaEstado };

const GraficoAlertasPorEstado = dynamic(
  () => import("./GraficoAlertasPorEstado").then((m) => m.GraficoAlertasPorEstado),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoAlertasPorEstadoLazy({ dados }: { dados: ItemAlertaEstado[] }) {
  return <GraficoAlertasPorEstado dados={dados} />;
}
