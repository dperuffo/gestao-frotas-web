// Gera um arquivo GPX 1.1 (waypoints + track da rota) para importar em
// GPS/Waze/apps de navegação — 100% client-side, sem dependência nova (GPX é
// só XML). Porta a função gerar_gpx_roteirizacao() do Streamlit.

import type { Ponto } from "./geo";
import type { ParadaSugerida } from "./roteirizacaoAlgoritmo";

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wpt(lat: number, lon: number, nome: string, descricao?: string): string {
  const desc = descricao ? `<desc>${escaparXml(descricao)}</desc>` : "";
  return `  <wpt lat="${lat}" lon="${lon}"><name>${escaparXml(nome)}</name>${desc}</wpt>`;
}

export function gerarGpx(params: {
  origem: { label: string; lat: number; lon: number };
  destino: { label: string; lat: number; lon: number };
  paradas: ParadaSugerida[];
  coordenadas: Ponto[];
  placa?: string;
}): string {
  const { origem, destino, paradas, coordenadas, placa } = params;

  const waypoints = [
    wpt(origem.lat, origem.lon, `Origem: ${origem.label}`),
    ...paradas.map((p, i) =>
      wpt(
        p.lat,
        p.lon,
        `#${i + 1} ${p.label}`,
        `${p.litrosSugeridos} L de combustível — ${p.custoAbastecimento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — km ${Math.round(p.km)}`
      )
    ),
    wpt(destino.lat, destino.lon, `Destino: ${destino.label}`),
  ].join("\n");

  const trackpoints = coordenadas.map((c) => `      <trkpt lat="${c.lat}" lon="${c.lon}"/>`).join("\n");

  const nomeRota = `${origem.label} -> ${destino.label}${placa ? ` (${placa})` : ""}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FNI Gestão de Frotas" xmlns="http://www.topografix.com/GPX/1/1">
${waypoints}
  <trk>
    <name>${escaparXml(nomeRota)}</name>
    <trkseg>
${trackpoints}
    </trkseg>
  </trk>
</gpx>
`;
}
