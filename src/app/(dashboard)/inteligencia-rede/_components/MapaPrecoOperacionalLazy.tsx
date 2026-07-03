"use client";

import dynamic from "next/dynamic";
import type { PontoPrecoMapa } from "./MapaPrecoOperacional";

const MapaPrecoOperacional = dynamic(() => import("./MapaPrecoOperacional").then((m) => m.MapaPrecoOperacional), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando mapa...
    </div>
  ),
});

export default function MapaPrecoOperacionalLazy({ pontos }: { pontos: PontoPrecoMapa[] }) {
  return <MapaPrecoOperacional pontos={pontos} />;
}
