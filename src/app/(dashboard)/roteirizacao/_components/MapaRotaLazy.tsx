"use client";

import dynamic from "next/dynamic";
import type { MarcadorMapa } from "./MapaRota";

// O Leaflet manipula `window`/`document` direto — precisa ser carregado só
// no navegador (ssr: false). Esse wrapper existe porque o Next.js só
// permite `ssr: false` dentro de um Client Component.
const MapaRota = dynamic(() => import("./MapaRota"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando mapa...
    </div>
  ),
});

export default function MapaRotaLazy(props: {
  marcadores: MarcadorMapa[];
  rota?: { lat: number; lon: number }[];
  alturaClasse?: string;
}) {
  return <MapaRota {...props} />;
}
