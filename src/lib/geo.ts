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

export type BoundingBox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

// Fase 27.21 — achado real: a Roteirização montava UM bounding box só, a
// partir do menor/maior lat/lon de TODA a rota, e consultava postos_gf/
// anp_postos com esse box + .limit(3000) sem .order(). Numa rota curta isso
// é inofensivo, mas numa rota longa (centenas/milhares de km cruzando vários
// estados) o box vira um retângulo enorme cobrindo boa parte do Brasil —
// e o .limit(3000) sem ordenação por proximidade descartava arbitrariamente
// candidatos reais bem próximos ao corredor da rota (resultado: cliente novo
// sem NENHUMA parada de abastecimento sugerida numa rota longa, mesmo com o
// fallback ANP ativo). Em vez de um box único, divide a polyline da rota em
// pedaços de até `passoKm` (capado a `maxSegmentos` pedaços, pra rotas
// gigantes não gerarem consultas demais) e devolve um box por pedaço — cada
// consulta feita com esses boxes fica naturalmente pequena e não esbarra no
// limit.
export function construirBoundingBoxesDaRota(
  rota: Ponto[],
  distanciasAcumuladasKm: number[],
  margemGraus: number,
  passoKm = 150,
  maxSegmentos = 20
): BoundingBox[] {
  if (rota.length === 0) return [];
  const totalKm = distanciasAcumuladasKm[distanciasAcumuladasKm.length - 1] ?? 0;
  const passoEfetivoKm = Math.max(passoKm, totalKm / maxSegmentos);

  const boxes: BoundingBox[] = [];
  let inicioIdx = 0;
  let inicioKm = 0;
  for (let i = 1; i < rota.length; i++) {
    const ultimoPonto = i === rota.length - 1;
    if (distanciasAcumuladasKm[i] - inicioKm >= passoEfetivoKm || ultimoPonto) {
      const fatia = rota.slice(inicioIdx, i + 1);
      const lats = fatia.map((p) => p.lat);
      const lons = fatia.map((p) => p.lon);
      boxes.push({
        minLat: Math.min(...lats) - margemGraus,
        maxLat: Math.max(...lats) + margemGraus,
        minLon: Math.min(...lons) - margemGraus,
        maxLon: Math.max(...lons) + margemGraus,
      });
      inicioIdx = i;
      inicioKm = distanciasAcumuladasKm[i];
    }
  }
  return boxes;
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

// "rapido" (padrão/sempre usado por calcularRotaOsrm) fica com a rota
// principal que o profile "driving" do OSRM devolve, otimizada por tempo.
// "curto" pede alternativas ao OSRM (alternatives=true) e fica com a de
// menor quilometragem total — usado internamente por
// buscarAlternativasRotaOsrm (ver abaixo) pra montar o seletor de rotas
// estilo Waze no Roteirizador Inteligente.
export type ModoCalculoRota = "rapido" | "curto";

// Calcula a rota rodoviária entre origem, destino e paradas intermediárias
// (na ordem informada) usando o OSRM público — mesmos servidores usados no
// Streamlit (calcular_rota()), tentados em sequência. Se ambos falharem,
// cai para uma linha reta entre os pontos (aproximação, mas garante que a
// funcionalidade não trave por indisponibilidade do serviço externo).
export async function calcularRotaOsrm(
  origem: Ponto,
  destino: Ponto,
  paradas: Ponto[] = [],
  modo: ModoCalculoRota = "rapido"
): Promise<ResultadoRota> {
  const pontos = [origem, ...paradas, destino];
  const coordsStr = pontos.map((p) => `${p.lon},${p.lat}`).join(";");
  const pedirAlternativas = modo === "curto";

  for (const servidor of OSRM_SERVIDORES) {
    try {
      const url = `${servidor}/${coordsStr}?overview=full&geometries=geojson${pedirAlternativas ? "&alternatives=true" : ""}`;
      const resp = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) continue;
      const json = await resp.json();
      const rotas: any[] | undefined = json?.routes;
      if (!rotas || rotas.length === 0) continue;
      // Em modo "curto" o OSRM pode devolver 1+ alternativas (nem sempre
      // encontra mais de uma, sobretudo com paradas intermediárias) — fica
      // sempre com a de menor `distance`, que na ausência de alternativas
      // reais é simplesmente a única rota devolvida (mesmo resultado do
      // modo "rapido").
      const rota = pedirAlternativas
        ? rotas.reduce((menor, atual) => (atual.distance < menor.distance ? atual : menor))
        : rotas[0];
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

export type OpcaoRota = ResultadoRota & { id: number };

// Fase Rotas-Alternativas (30/07/2026) — pedido do Daniel: "podemos evoluir
// como o Waze, onde apresenta as rotas para o usuário e ele define qual
// será a melhor para ele". Pede ao OSRM todas as alternativas conhecidas
// pro trajeto (alternatives=true) e devolve todas, sem escolher nenhuma —
// quem decide é a tela (FormRoteirizacao.tsx), mostrando km/tempo de cada
// uma. Nem sempre o OSRM encontra mais de uma rota real (comum em trechos
// sem opção viável de desvio, ou com paradas intermediárias) — nesse caso
// devolve só 1 opção, e a tela pula o seletor.
export async function buscarAlternativasRotaOsrm(
  origem: Ponto,
  destino: Ponto,
  paradas: Ponto[] = []
): Promise<OpcaoRota[]> {
  const pontos = [origem, ...paradas, destino];
  const coordsStr = pontos.map((p) => `${p.lon},${p.lat}`).join(";");

  for (const servidor of OSRM_SERVIDORES) {
    try {
      const url = `${servidor}/${coordsStr}?overview=full&geometries=geojson&alternatives=true`;
      const resp = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
      if (!resp.ok) continue;
      const json = await resp.json();
      const rotas: any[] | undefined = json?.routes;
      if (!rotas || rotas.length === 0) continue;

      const opcoes: OpcaoRota[] = rotas.map((rota, i) => ({
        id: i,
        coordenadas: rota.geometry.coordinates.map(([lon, lat]: [number, number]) => ({ lat, lon })),
        distanciaKm: Math.round((rota.distance / 1000) * 10) / 10,
        duracaoMin: Math.round(rota.duration / 60),
        linhaReta: false,
      }));

      // Descarta "alternativas" praticamente idênticas à principal (o OSRM
      // às vezes devolve variações de <1km/1min que não ajudam o gestor a
      // decidir nada, só poluem o seletor).
      const distintas: OpcaoRota[] = [];
      for (const op of opcoes) {
        const duplicada = distintas.some(
          (v) => Math.abs(v.distanciaKm - op.distanciaKm) < 1 && Math.abs(v.duracaoMin - op.duracaoMin) < 2
        );
        if (!duplicada) distintas.push(op);
      }
      return distintas;
    } catch {
      continue;
    }
  }

  // Fallback: OSRM indisponível — mesma linha reta de calcularRotaOsrm,
  // como opção única (sem seletor de alternativas nesse caso).
  const linhaReta = await calcularRotaOsrm(origem, destino, paradas, "rapido");
  return [{ ...linhaReta, id: 0 }];
}
