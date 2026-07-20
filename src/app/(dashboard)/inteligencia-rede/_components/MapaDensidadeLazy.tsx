"use client";

import dynamic from "next/dynamic";
import type { PontoDensidade } from "./MapaDensidade";

// O Leaflet manipula `window`/`document` direto — precisa carregar só no
// navegador (ssr: false), que só é permitido dentro de um Client Component.
const MapaDensidade = dynamic(() => import("./MapaDensidade").then((m) => m.MapaDensidade), {
  ssr: false,
  loading: () => (
    <div className="flex h-[680px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando mapa...
    </div>
  ),
});

export default function MapaDensidadeLazy({ pontos }: { pontos: PontoDensidade[] }) {
  return <MapaDensidade pontos={pontos} />;
}
