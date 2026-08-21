"use client";

import dynamic from "next/dynamic";
import type { ItemEficienciaVeiculo } from "./GraficoEficienciaVeiculos";
export type { ItemEficienciaVeiculo };

const GraficoEficienciaVeiculos = dynamic(
  () => import("./GraficoEficienciaVeiculos").then((m) => m.GraficoEficienciaVeiculos),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Carregando gráfico...
      </div>
    ),
  }
);

export default function GraficoEficienciaVeiculosLazy({ dados }: { dados: ItemEficienciaVeiculo[] }) {
  return <GraficoEficienciaVeiculos dados={dados} />;
}
