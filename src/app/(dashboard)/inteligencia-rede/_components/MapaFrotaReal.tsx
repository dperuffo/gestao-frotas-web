"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type PontoFrotaReal = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  visitas: number;
  precoMedio: number;
  cor: string;
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

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// Mapa de calor dos postos realmente visitados pela frota: raio do círculo
// proporcional ao número de visitas (6-26px, capado em 50 visitas), cor
// conforme o preço médio pago (verde barato → vermelho caro).
export function MapaFrotaReal({ pontos }: { pontos: PontoFrotaReal[] }) {
  const todosPontos = useMemo<[number, number][]>(() => pontos.map((p) => [p.lat, p.lon]), [pontos]);

  if (pontos.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Nenhum abastecimento com coordenada do posto no período.
      </div>
    );
  }

  const centro: [number, number] = [-15.78, -47.93];

  return (
    <div className="relative h-[480px] overflow-hidden rounded-lg border border-slate-200">
      <MapContainer center={centro} zoom={4} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pontos.map((p) => (
          <CircleMarker
            key={p.cnpj}
            center={[p.lat, p.lon]}
            radius={Math.min(p.visitas, 50) / 50 * 20 + 6}
            pathOptions={{ color: p.cor, fillColor: p.cor, fillOpacity: 0.7, weight: 1, opacity: 0.85 }}
          >
            <Tooltip direction="top" opacity={0.95}>
              <strong>{p.razaoSocial ?? "Posto"}</strong>
              <br />
              {[p.municipio, p.uf].filter(Boolean).join(" / ")}
              <br />
              Visitas: {p.visitas}
              <br />
              Preço médio pago: {formatarMoeda(p.precoMedio)}
            </Tooltip>
          </CircleMarker>
        ))}
        <AjustarLimites pontos={todosPontos} />
      </MapContainer>
    </div>
  );
}
