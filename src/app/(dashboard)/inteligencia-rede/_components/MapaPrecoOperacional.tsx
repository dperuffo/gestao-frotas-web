"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type PontoPrecoMapa = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  preco: number;
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

// Mapa de calor de preços: cada posto colorido conforme sua faixa de preço
// (normalização min-max em 3 faixas — verde/laranja/vermelho) pro
// combustível selecionado no painel Operacional.
export function MapaPrecoOperacional({ pontos }: { pontos: PontoPrecoMapa[] }) {
  const todosPontos = useMemo<[number, number][]>(() => pontos.map((p) => [p.lat, p.lon]), [pontos]);

  if (pontos.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400">
        Nenhum posto com coordenada e preço cadastrados para esse combustível.
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
            radius={5}
            pathOptions={{ color: p.cor, fillColor: p.cor, fillOpacity: 0.75, weight: 1, opacity: 0.85 }}
          >
            <Tooltip direction="top" opacity={0.95}>
              <strong>{p.razaoSocial ?? "Posto GF"}</strong>
              <br />
              {[p.municipio, p.uf].filter(Boolean).join(" / ")}
              <br />
              {formatarMoeda(p.preco)}
            </Tooltip>
          </CircleMarker>
        ))}
        <AjustarLimites pontos={todosPontos} />
      </MapContainer>
    </div>
  );
}
