// Utilitários de geografia para a Roteirização (Fase 7): distância,
// geocodificação e cálculo de rota. Porta a lógica do app interno em
// Streamlit (estudo_de_rede.py), que usa os mesmos serviços públicos:
// Nominatim (geocodificação) e OSRM (roteamento) — ambos gratuitos e sem
// necessidade de chave de API.

export type Ponto = { lat: number; lon: number };

const RAIO_TERRA_KM = 6371;

// Distância em linha reta entre dois pontos (fórmula de haversine).
export function haversineKm(a: Ponto, b: Ponto): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return RAIO_TERRA_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Distância mínima (km) de um ponto até uma polilinha (a rota, como lista de
// pontos [lat, lon]) — equivalente ao dist_minima_rota_np() do Streamlit,
// que projeta o ponto sobre cada segmento da rota e fica com a menor
// distância. Aqui simplificamos usando graus como se fossem um plano local
// (válido para segmentos curtos, que é o caso entre pontos consecutivos de
// uma rota do OSRM) e convertendo o resultado final para km via haversine.
export function distanciaAteRotaKm(ponto: Ponto, rota: Ponto[]): number {
  if (rota.length === 0) return Infinity;
  if (rota.length === 1) return haversineKm(ponto, rota[0]);

  let menor = Infinity;
  for (let i = 0; i < rota.length - 1; i++) {
    const a = rota[i];
    const b = rota[i + 1];
    const proj = projetarPontoNoSegmento(ponto, a, b);
    const d = haversineKm(ponto, proj);
    if (d < menor) menor = d;
  }
  return menor;
}

// Projeta "ponto" sobre o segmento a-b (em coordenadas lat/lon tratadas como
// plano cartesiano local — erro desprezível na escala de poucos km entre
// vértices consecutivos de uma rota rodoviária).
function projetarPontoNoSegmento(ponto: Ponto, a: Ponto, b: Ponto): Ponto {
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  const comprimento2 = dx * dx + dy * dy;
  if (comprimento2 === 0) return a;
  let t = ((ponto.lon - a.lon) * dx + (ponto.lat - a.lat) * dy) / comprimento2;
  t = Math.max(0, Math.min(1, t));
  return { lat: a.lat + t * dy, lon: a.lon + t * dx };
}

// Também retorna a distância percorrida na rota (km, a partir da origem) até
// o ponto mais próximo do posto — usado pelo algoritmo de otimização para
// saber "em que km da viagem" cada posto candidato fica.
export function posicaoNaRotaKm(
  ponto: Ponto,
  rota: Ponto[],
  distanciasAcumuladasKm: number[]
): { km: number; desvioKm: number } {
  if (rota.length === 0) return { km: 0, desvioKm: Infinity };
  let melhorDist = Infinity;
  let melhorKm = 0;
  for (let i = 0; i < rota.length - 1; i++) {
    const a = rota[i];
    const b = rota[i + 1];
    const proj = projetarPontoNoSegmento(ponto, a, b);
    const d = haversineKm(ponto, proj);
    if (d < melhorDist) {
      melhorDist = d;
      const distSegmento = haversineKm(a, b);
      const distAteProjecao = haversineKm(a, proj);
      const fracao = distSegmento > 0 ? distAteProjecao / distSegmento : 0;
      melhorKm =
        distanciasAcumuladasKm[i] + fracao * (distanciasAcumuladasKm[i + 1] - distanciasAcumuladasKm[i]);
    }
  }
  return { km: melhorKm, desvioKm: melhorDist };
}

export function distanciasAcumuladas(rota: Ponto[]): number[] {
  const acc = [0];
  for (let i = 1; i < rota.length; i++) {
    acc.push(acc[i - 1] + haversineKm(rota[i - 1], rota[i]));
  }
  return acc;
}

export type SugestaoGeocoding = { label: string; lat: number; lon: number };

// Busca de local por texto livre via Nominatim (OpenStreetMap) — mesmo
// serviço e mesmos parâmetros usados no Streamlit (sugestoes_nominatim()).
// Uso "gratuito e sem chave", mas exige um User-Agent identificável e um
// volume baixo de chamadas (política de uso do Nominatim).
export async function geocodificar(texto: string): Promise<SugestaoGeocoding[]> {
  const termo = texto.trim();
  if (termo.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${termo}, Brasil`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("addressdetails", "1");

  try {
    const resp = await fetch(url.toString(), {
      headers: { "User-Agent": "GestaoDeFrotas-NextJS/1.0 (contato: d.peruffo@gmail.com)" },
      // Nominatim não deve ser cacheado agressivamente pelo Next.js.
      cache: "no-store",
    });
    if (!resp.ok) return [];
    const itens: any[] = await resp.json();
    const vistos = new Set<string>();
    const opcoes: SugestaoGeocoding[] = [];
    for (const item of itens) {
      const addr = item.address ?? {};
      const cidade = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
      const estado = addr.state || "";
      const label =
        cidade && estado
          ? `${cidade} – ${estado}`
          : estado || String(item.display_name ?? "").split(", ").slice(0, 2).join(", ");
      if (!vistos.has(label)) {
        vistos.add(label);
        opcoes.push({ label, lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
      }
    }
    return opcoes;
  } catch {
    return [];
  }
}

export type ResultadoRota = {
  coordenadas: Ponto[];
  distanciaKm: number;
  duracaoMin: number;
  linhaReta: boolean;
};

const OSRM_SERVIDORES = [
  "https://router.project-osrm.org/route/v1/driving",
  "https://routing.openstreetmap.de/routed-car/route/v1/driving",
];

// Calcula a rota rodoviária entre origem, destino e paradas intermediárias
// (na ordem informada) usando o OSRM público — mesmos servidores usados no
// Streamlit (calcular_rota()), tentados em sequência. Se ambos falharem,
// cai para uma linha reta entre os pontos (aproximação, mas garante que a
// funcionalidade não trave por indisponibilidade do serviço externo).
export async function calcularRotaOsrm(
  origem: Ponto,
  destino: Ponto,
  paradas: Ponto[] = []
): Promise<ResultadoRota> {
  const pontos = [origem, ...paradas, destino];
  const coordsStr = pontos.map((p) => `${p.lon},${p.lat}`).join(";");

  for (const servidor of OSRM_SERVIDORES) {
    try {
      const url = `${servidor}/${coordsStr}?overview=full&geometries=geojson`;
      const resp = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) continue;
      const json = await resp.json();
      const rota = json?.routes?.[0];
      if (!rota) continue;
      const coordenadas: Ponto[] = rota.geometry.coordinates.map(
        ([lon, lat]: [number, number]) => ({ lat, lon })
      );
      return {
        coordenadas,
        distanciaKm: rota.distance / 1000,
        duracaoMin: rota.duration / 60,
        linhaReta: false,
      };
    } catch {
      continue;
    }
  }

  // Fallback: segmentos de linha reta entre os pontos informados.
  const coordenadas: Ponto[] = [];
  const segmentosPorTrecho = 12;
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    for (let j = 0; j < segmentosPorTrecho; j++) {
      const t = j / segmentosPorTrecho;
      coordenadas.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
    }
  }
  coordenadas.push(pontos[pontos.length - 1]);
  let distanciaKm = 0;
  for (let i = 0; i < pontos.length - 1; i++) distanciaKm += haversineKm(pontos[i], pontos[i + 1]);
  return { coordenadas, distanciaKm, duracaoMin: (distanciaKm / 80) * 60, linhaReta: true };
}
