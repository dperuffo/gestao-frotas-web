// Fase Pedágios — pedido do Daniel: integrar a base de praças de pedágio
// (tabela pública `pracas_pedagio`, ver README/migração "Fase Pedágios") na
// Roteirização, nos Planos de Viagem e no Rotograma de Segurança. Este
// módulo concentra a busca de praças no corredor de uma rota e o cálculo do
// custo por categoria de veículo — reaproveitado pelas 3 telas acima, mesmo
// racional de `postos_gf`/`anp_postos` em src/lib/geo.ts e
// roteirizacao/actions.ts (bounding boxes por pedaço da rota + filtro por
// desvio máximo até a polilinha).
import { construirBoundingBoxesDaRota, posicaoNaRotaKm, type Ponto } from "@/lib/geo";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type PracaPedagio = {
  id: number;
  nome: string;
  concessionaria: string | null;
  rodovia: string | null;
  uf: string | null;
  lat: number;
  lon: number;
  valorCarro: number | null;
  valorMoto: number | null;
  valorCaminhaoEixo: number | null;
};

export type PracaPedagioNaRota = PracaPedagio & {
  kmNaRota: number;
  desvioKm: number;
};

// Categoria simplificada de veículo pra escolher qual valor de tarifa usar —
// "carro" cobre também utilitários pequenos, "caminhao" precisa do número de
// eixos (tarifa costuma ser por eixo nas concessões brasileiras).
export type CategoriaVeiculoPedagio = "carro" | "moto" | "caminhao";

// Raio padrão do corredor — um pouco mais largo que o usado pra postos (5km)
// porque praças de pedágio ficam sempre EM CIMA da rodovia (sem desvio pra
// entrar, diferente de postos que podem estar a alguns km da pista), mas a
// rota calculada pelo OSRM pode serpentear um pouco em relação ao eixo real
// da rodovia em trechos urbanos/entroncamentos.
const RAIO_CORREDOR_PADRAO_KM = 3;

function linhaParaPraca(l: {
  id: number;
  nome: string;
  concessionaria: string | null;
  rodovia: string | null;
  uf: string | null;
  lat: number;
  lon: number;
  valor_carro: number | null;
  valor_moto: number | null;
  valor_caminhao_eixo: number | null;
}): PracaPedagio {
  return {
    id: l.id,
    nome: l.nome,
    concessionaria: l.concessionaria,
    rodovia: l.rodovia,
    uf: l.uf,
    lat: Number(l.lat),
    lon: Number(l.lon),
    valorCarro: l.valor_carro,
    valorMoto: l.valor_moto,
    valorCaminhaoEixo: l.valor_caminhao_eixo,
  };
}

// Busca as praças de pedágio no corredor de uma rota já calculada (mesmos
// `rota`/`distanciasAcumuladasKm` usados pra achar postos) — divide em
// bounding boxes por pedaço (construirBoundingBoxesDaRota) pra não estourar
// o limite de retorno em rotas longas, depois filtra pelo desvio real até a
// polilinha.
export async function buscarPracasPedagioNaRota(
  supabase: SupabaseServerClient,
  rota: Ponto[],
  distanciasAcumuladasKm: number[],
  raioKm: number = RAIO_CORREDOR_PADRAO_KM
): Promise<PracaPedagioNaRota[]> {
  if (rota.length === 0) return [];

  const margemGraus = raioKm / 100; // ~1 grau ≈ 100km, mesma aproximação de calcularRoteirizacaoAcao
  const boxes = construirBoundingBoxesDaRota(rota, distanciasAcumuladasKm, margemGraus);
  if (boxes.length === 0) return [];

  const resultadosPorBox = await Promise.all(
    boxes.map((box) =>
      supabase
        .from("pracas_pedagio")
        .select("id, nome, concessionaria, rodovia, uf, lat, lon, valor_carro, valor_moto, valor_caminhao_eixo")
        .gte("lat", box.minLat)
        .lte("lat", box.maxLat)
        .gte("lon", box.minLon)
        .lte("lon", box.maxLon)
        .limit(500)
    )
  );

  const brutas = Array.from(
    new Map(resultadosPorBox.flatMap((r) => r.data ?? []).map((p) => [p.id, p])).values()
  );

  return brutas
    .map((p) => {
      const praca = linhaParaPraca(p);
      const { km, desvioKm } = posicaoNaRotaKm({ lat: praca.lat, lon: praca.lon }, rota, distanciasAcumuladasKm);
      return { ...praca, kmNaRota: km, desvioKm };
    })
    .filter((p) => p.desvioKm <= raioKm)
    .sort((a, b) => a.kmNaRota - b.kmNaRota);
}

// Valor de referência do pedágio pra uma praça, conforme a categoria do
// veículo — caminhão multiplica o valor "por eixo" pelo nº de eixos (padrão
// brasileiro de tarifação); sem nº de eixos informado, assume 2 (padrão de
// um caminhão leve/toco, mesmo fallback usado no formulário de veículo).
export function valorPedagio(
  praca: Pick<PracaPedagio, "valorCarro" | "valorMoto" | "valorCaminhaoEixo">,
  categoria: CategoriaVeiculoPedagio,
  numEixos: number = 2
): number | null {
  if (categoria === "moto") return praca.valorMoto;
  if (categoria === "caminhao") return praca.valorCaminhaoEixo != null ? praca.valorCaminhaoEixo * numEixos : null;
  return praca.valorCarro;
}

// Soma do custo total de pedágio pra uma lista de praças no corredor —
// praças sem valor cadastrado (base ainda incompleta pra aquele trecho) são
// ignoradas na soma, mas continuam aparecendo no mapa/lista pro usuário
// completar manualmente se quiser.
export function custoPedagioTotal(
  pracas: Pick<PracaPedagio, "valorCarro" | "valorMoto" | "valorCaminhaoEixo">[],
  categoria: CategoriaVeiculoPedagio,
  numEixos: number = 2
): number {
  return pracas.reduce((soma, p) => {
    const valor = valorPedagio(p, categoria, numEixos);
    return soma + (valor ?? 0);
  }, 0);
}
