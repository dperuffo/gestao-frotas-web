"use client";

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PostoPopupContent } from "./PostoPopupContent";
import { CORES_HEX, formatarLabelBandeira, type CorMarcador } from "@/lib/coresBandeira";
import { normalizarTexto } from "@/lib/utils";

// O Leaflet, por padrão, referencia os ícones de marcador via caminho
// relativo que quebra com o bundler do Next.js — apontamos para o CDN
// público do próprio pacote para evitar ícones quebrados/invisíveis.
const iconePadrao = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function icone(cor: CorMarcador = "azul") {
  return L.divIcon({
    className: "",
    html: `<div style="background:${CORES_HEX[cor]};width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export type MarcadorMapa = {
  lat: number;
  lon: number;
  label: string;
  popup?: string;
  cor?: CorMarcador;
  // Quando presente, o marcador é um posto: ao clicar, carrega (sob
  // demanda) um card com razão social, CNPJ, cidade/UF, bandeira e o preço
  // vigente de cada combustível (próprio do posto ou estimativa ANP).
  cnpj?: string;
  // Linha extra mostrada acima do card do posto, sem precisar de busca
  // (ex: "12 L sugeridos · R$ 68,40" numa parada de roteirização).
  infoExtra?: string;
  // Nome mostrado na legenda do mapa (normalmente a bandeira/distribuidora
  // do posto) — só marcadores de posto (com `cnpj`) entram na legenda.
  legendaLabel?: string;
};

function AjustarLimites({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (pontos.length > 0) {
      map.fitBounds(pontos, { padding: [30, 30], maxZoom: 13 });
    }
  }, [pontos, map]);
  return null;
}

export default function MapaRota({
  marcadores,
  rota,
  alturaClasse = "h-[420px]",
}: {
  marcadores: MarcadorMapa[];
  rota?: { lat: number; lon: number }[];
  alturaClasse?: string;
}) {
  // Posto cujo popup rico está aberto no momento — controlado à parte dos
  // Markers de posto (que não têm Popup próprio) pra garantir que o
  // detalhe (com preços) só seja buscado no clique, nunca para os N
  // marcadores de uma vez.
  const [postoAberto, setPostoAberto] = useState<{
    lat: number;
    lon: number;
    cnpj: string;
    infoExtra?: string;
  } | null>(null);

  const centro: [number, number] =
    marcadores.length > 0 ? [marcadores[0].lat, marcadores[0].lon] : [-15.78, -47.93];

  const todosPontos: [number, number][] = [
    ...marcadores.map((m): [number, number] => [m.lat, m.lon]),
    ...(rota ?? []).map((p): [number, number] => [p.lat, p.lon]),
  ];

  // Legenda: uma entrada por combinação (cor, rótulo) entre os marcadores
  // de posto exibidos — assim ela reflete exatamente o que está no mapa,
  // sem listar bandeira que não apareceu nessa consulta.
  //
  // Fase 27.146 — achado do Daniel: "Ale"/"ALE", "Ipiranga"/"IPIRANGA" etc.
  // apareciam como linhas separadas (mesma cor, rótulo cru diferente) por
  // causa da capitalização variar entre postos_gf e anp_postos. Agrupa pela
  // versão normalizada (sem acento/maiúscula, mesmo critério de
  // corPorBandeira) e mostra sempre o rótulo em Title Case.
  const legenda = useMemo(() => {
    const vistos = new Map<string, { cor: CorMarcador; label: string }>();
    for (const m of marcadores) {
      if (!m.cnpj) continue;
      const cor = m.cor ?? "azul";
      const label = formatarLabelBandeira(m.legendaLabel);
      const chave = `${cor}__${normalizarTexto(label)}`;
      if (!vistos.has(chave)) vistos.set(chave, { cor, label });
    }
    return Array.from(vistos.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [marcadores]);

  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 ${alturaClasse}`}>
      <MapContainer center={centro} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {rota && rota.length > 1 && (
          <Polyline positions={rota.map((p) => [p.lat, p.lon])} pathOptions={{ color: "#2563eb", weight: 4 }} />
        )}
        {marcadores.map((m, i) =>
          m.cnpj ? (
            <Marker
              key={i}
              position={[m.lat, m.lon]}
              icon={m.cor ? icone(m.cor) : iconePadrao}
              eventHandlers={{
                click: () => setPostoAberto({ lat: m.lat, lon: m.lon, cnpj: m.cnpj!, infoExtra: m.infoExtra }),
              }}
            />
          ) : (
            <Marker key={i} position={[m.lat, m.lon]} icon={m.cor ? icone(m.cor) : iconePadrao}>
              <Popup>
                <strong>{m.label}</strong>
                {m.popup && <div className="mt-1 text-xs">{m.popup}</div>}
              </Popup>
            </Marker>
          )
        )}
        {postoAberto && (
          <Popup
            position={[postoAberto.lat, postoAberto.lon]}
            eventHandlers={{ remove: () => setPostoAberto(null) }}
            minWidth={220}
            maxWidth={260}
            maxHeight={320}
            autoPan
          >
            {postoAberto.infoExtra && (
              <p className="mb-1.5 text-xs font-semibold text-frota-600">{postoAberto.infoExtra}</p>
            )}
            <PostoPopupContent cnpj={postoAberto.cnpj} lat={postoAberto.lat} lon={postoAberto.lon} />
          </Popup>
        )}
        {todosPontos.length > 0 && <AjustarLimites pontos={todosPontos} />}
      </MapContainer>

      {legenda.length > 0 && (
        <div className="absolute bottom-2 left-2 z-[1000] max-h-[45%] max-w-[55%] overflow-y-auto rounded-lg bg-white/95 p-2 text-xs shadow-md">
          {legenda.map((l) => (
            <div key={`${l.cor}__${l.label}`} className="flex items-center gap-1.5 py-0.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow"
                style={{ background: CORES_HEX[l.cor] }}
              />
              <span className="truncate text-slate-700">{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
