"use client";

import dynamic from "next/dynamic";
import type { PontoFrotaReal } from "./MapaFrotaReal";

const MapaFrotaReal = dynamic(() => import("./MapaFrotaReal").then((m) => m.MapaFrotaReal), {
  ssr: false,
  loading: () => (
    <div className="flex h-[640px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
      Carregando mapa...
    </div>
  ),
});

export default function MapaFrotaRealLazy({ pontos }: { pontos: PontoFrotaReal[] }) {
  return <MapaFrotaReal pontos={pontos} />;
}
