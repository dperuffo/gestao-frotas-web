"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type PontoGap = { uf: string; demanda: number; postosGf: number; gapScore: number; cor: string; lat: number; lon: number };

function AjustarLimites({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (pontos.length > 0) {
      map.fitBounds(pontos, { padding: [20, 20], maxZoom: 5 });
    }
  }, [pontos, map]);
  return null;
}

// Bolha por UF: tamanho = demanda (abastecimentos reais da frota naquele
// estado), cor = severidade do Gap Score (verde → vermelho).
export function MapaGapCobertura({ pontos }: { pontos: PontoGap[] }) {
  const todosPontos = useMemo<[number, number][]>(() => pontos.map((p) => [p.lat, p.lon]), [pontos]);
  const demandaMax = Math.max(1, ...pontos.map((p) => p.demanda));

  if (pontos.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Sem abastecimentos reais registrados para gerar o mapa de demanda.
      </div>
    );
  }

  const centro: [number, number] = [-15.78, -47.93];

  return (
    <div className="relative h-[460px] overflow-hidden rounded-lg border border-slate-200">
      <MapContainer center={centro} zoom={4} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pontos.map((p) => (
          <CircleMarker
            key={p.uf}
            center={[p.lat, p.lon]}
            radius={(p.demanda / demandaMax) * 26 + 8}
            pathOptions={{ color: p.cor, fillColor: p.cor, fillOpacity: 0.6, weight: 1.5, opacity: 0.9 }}
          >
            <Tooltip direction="top" opacity={0.95}>
              <strong>{p.uf}</strong>
              <br />
              Demanda (abast. reais): {p.demanda}
              <br />
              Postos GF: {p.postosGf}
              <br />
              Gap Score: {p.gapScore.toFixed(3)}
            </Tooltip>
          </CircleMarker>
        ))}
        <AjustarLimites pontos={todosPontos} />
      </MapContainer>
    </div>
  );
}
