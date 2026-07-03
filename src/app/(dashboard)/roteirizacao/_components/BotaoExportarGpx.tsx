"use client";

import { gerarGpx } from "@/lib/gpx";
import type { Ponto } from "@/lib/geo";
import type { ParadaSugerida } from "@/lib/roteirizacaoAlgoritmo";

function baixarArquivo(nomeArquivo: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function BotaoExportarGpx({
  origem,
  destino,
  paradas,
  coordenadas,
  placa,
}: {
  origem: { label: string; lat: number; lon: number };
  destino: { label: string; lat: number; lon: number };
  paradas: ParadaSugerida[];
  coordenadas: Ponto[];
  placa?: string;
}) {
  function exportar() {
    const gpx = gerarGpx({ origem, destino, paradas, coordenadas, placa });
    const slug = (s: string) => s.slice(0, 15).replace(/\s+/g, "_");
    const agora = new Date();
    const carimbo = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, "0")}${String(agora.getDate()).padStart(2, "0")}_${String(agora.getHours()).padStart(2, "0")}${String(agora.getMinutes()).padStart(2, "0")}`;
    baixarArquivo(`rota_${slug(origem.label)}_${slug(destino.label)}_${carimbo}.gpx`, gpx, "application/gpx+xml");
  }

  return (
    <button type="button" className="btn-secondary" onClick={exportar}>
      🗺️ Exportar GPX
    </button>
  );
}
