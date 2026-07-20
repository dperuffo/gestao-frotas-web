"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type PontoDensidade = {
  cnpj: string;
  razao_social: string | null;
  municipio: string | null;
  uf: string | null;
  lat: number;
  lon: number;
};

function AjustarLimites({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (pontos.length > 0) {
      map.fitBounds(pontos, { padding: [20, 20], maxZoom: 6 });
    }
  }, [pontos, map]);
  return null;
}

// Mapa de "densidade" no mesmo espírito do Streamlit: pontos pequenos e
// semitransparentes — onde há muitos postos próximos, os círculos se
// sobrepõem e a região fica visualmente mais escura/carregada, sem precisar
// de uma camada de heatmap dedicada (nem depender de milhares de ícones
// individuais, que deixariam o mapa pesado com ~3 mil postos).
export function MapaDensidade({ pontos }: { pontos: PontoDensidade[] }) {
  const todosPontos = useMemo<[number, number][]>(() => pontos.map((p) => [p.lat, p.lon]), [pontos]);

  if (pontos.length === 0) {
    return (
      <div className="flex h-[680px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Nenhum posto com coordenadas cadastradas para exibir no mapa.
      </div>
    );
  }

  const centro: [number, number] = [-15.78, -47.93];

  return (
    <div className="relative h-[680px] overflow-hidden rounded-lg border border-slate-200">
      <MapContainer center={centro} zoom={4} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pontos.map((p) => (
          <CircleMarker
            key={p.cnpj}
            center={[p.lat, p.lon]}
            radius={4}
            pathOptions={{ color: "#1565C0", fillColor: "#1565C0", fillOpacity: 0.55, weight: 1, opacity: 0.65 }}
          >
            <Tooltip direction="top" opacity={0.95}>
              <strong>{p.razao_social ?? "Posto GF"}</strong>
              <br />
              {[p.municipio, p.uf].filter(Boolean).join(" / ")}
            </Tooltip>
          </CircleMarker>
        ))}
        <AjustarLimites pontos={todosPontos} />
      </MapContainer>
    </div>
  );
}
