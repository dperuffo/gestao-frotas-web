"use client";

import dynamic from "next/dynamic";
import type { ParadaSugerida } from "@/lib/roteirizacaoAlgoritmo";

// GraficosRota renderiza 3 gráficos recharts (custo acumulado, nível do
// tanque, custo por posto) — placeholder cobre a altura aproximada da soma
// dos 3 (260 + 240 + ~220) pra evitar salto de layout enquanto carrega.
const GraficosRota = dynamic(() => import("./GraficosRota").then((m) => m.GraficosRota), {
  ssr: false,
  loading: () => (
    <div className="flex h-[700px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Carregando gráficos...
    </div>
  ),
});

export default function GraficosRotaLazy(props: {
  paradas: ParadaSugerida[];
  distanciaKm: number;
  origemLabel: string;
  destinoLabel: string;
  capacidadeTanqueL: number;
  autonomiaKmPorL: number;
}) {
  return <GraficosRota {...props} />;
}
