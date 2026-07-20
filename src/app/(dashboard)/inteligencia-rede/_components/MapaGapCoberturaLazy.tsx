"use client";

import dynamic from "next/dynamic";
import type { PontoGap } from "./MapaGapCobertura";

const MapaGapCobertura = dynamic(() => import("./MapaGapCobertura").then((m) => m.MapaGapCobertura), {
  ssr: false,
  loading: () => (
    <div className="flex h-[640px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando mapa...
    </div>
  ),
});

export default function MapaGapCoberturaLazy({ pontos }: { pontos: PontoGap[] }) {
  return <MapaGapCobertura pontos={pontos} />;
}
