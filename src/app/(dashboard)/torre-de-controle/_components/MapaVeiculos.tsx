"use client";

import MapaRotaLazy from "../../roteirizacao/_components/MapaRotaLazy";
import type { MarcadorMapa } from "../../roteirizacao/_components/MapaRota";
import type { CorMarcador } from "@/lib/coresBandeira";

export type PosicaoVeiculo = {
  placa: string;
  lat: number;
  lon: number;
  velocidadeKmh: number | null;
  timestampGps: string;
  provedor: string | null;
};

// Fase Grupo 2 (Rodopar/Datapar, item 4, 03/08/2026) — mapa ao vivo da Torre
// de Controle, alimentado pelo endpoint genérico de ingestão GPS
// (/api/integracoes/gps). Reaproveita o mesmo MapaRota da Roteirização — só
// muda o que vira marcador (última posição por placa em vez de postos).
function corPorIdade(timestampGps: string): CorMarcador {
  const minutos = (Date.now() - new Date(timestampGps).getTime()) / 60000;
  if (minutos <= 15) return "verde";
  if (minutos <= 120) return "amarelo";
  return "cinza";
}

function tempoRelativo(isoDate: string): string {
  const diffMin = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffDias = Math.round(diffH / 24);
  return `há ${diffDias} dia${diffDias === 1 ? "" : "s"}`;
}

export function MapaVeiculos({ posicoes }: { posicoes: PosicaoVeiculo[] }) {
  const marcadores: MarcadorMapa[] = posicoes.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    label: p.placa,
    popup: `${p.velocidadeKmh != null ? `${p.velocidadeKmh} km/h · ` : ""}${tempoRelativo(p.timestampGps)}${p.provedor ? ` · ${p.provedor}` : ""}`,
    cor: corPorIdade(p.timestampGps),
  }));

  return (
    <div>
      <MapaRotaLazy marcadores={marcadores} alturaClasse="h-[420px]" />
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#16a34a" }} /> Posição recente (≤15 min)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#eab308" }} /> Até 2h atrás
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#64748b" }} /> Mais de 2h sem sinal
        </span>
      </div>
    </div>
  );
}
