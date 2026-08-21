"use client";

import dynamic from "next/dynamic";
import type { PontoConsumo } from "./GraficoConsumo";
export type { PontoConsumo };

// Fase Priority-3-lazy-charts (21/08/2026, plano de performance) — recharts
// é pesado e só é usado dentro deste gráfico; carregar sob demanda no
// navegador em vez de embutir no bundle inicial da rota, mesmo padrão já
// usado para mapas (Leaflet) e exportação de PDF.
const GraficoConsumo = dynamic(() => import("./GraficoConsumo").then((m) => m.GraficoConsumo), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráfico...
    </div>
  ),
});

export default function GraficoConsumoLazy({ dados }: { dados: PontoConsumo[] }) {
  return <GraficoConsumo dados={dados} />;
}
