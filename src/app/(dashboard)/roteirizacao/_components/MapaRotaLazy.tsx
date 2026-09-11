"use client";

import dynamic from "next/dynamic";
import type { MarcadorMapa } from "./MapaRota";

// O Leaflet manipula `window`/`document` direto — precisa ser carregado só
// no navegador (ssr: false). Esse wrapper existe porque o Next.js só
// permite `ssr: false` dentro de um Client Component.
const MapaRota = dynamic(() => import("./MapaRota"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-400">
      Carregando mapa...
    </div>
  ),
});

export default function MapaRotaLazy(props: {
  marcadores: MarcadorMapa[];
  rota?: { lat: number; lon: number }[];
  rotasAlternativas?: { id: number; coordenadas: { lat: number; lon: number }[] }[];
  rotaSelecionadaId?: number | null;
  onSelecionarRota?: (id: number) => void;
  alturaClasse?: string;
  onTogglePosto?: (cnpj: string) => void;
}) {
  return <MapaRota {...props} />;
}
