"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import {
  geocodificar,
  calcularRotaOsrm,
  distanciasAcumuladas,
  posicaoNaRotaKm,
  construirBoundingBoxesDaRota,
  type Ponto,
  type SugestaoGeocoding,
} from "@/lib/geo";
import { calcularScorePosto, PERFIS_PESO, type ScorePosto } from "@/lib/roteirizacaoScore";
import { otimizarAbastecimento, type ParadaSugerida, type CandidatoAbastecimento } from "@/lib/roteirizacaoAlgoritmo";
import { resolverPrecosVigentes, type PrecoResolvido } from "@/lib/precoVigente";
import { PRODUTO_PARA_CATEGORIA_ANP, UF_PARA_ESTADO_ANP } from "@/lib/constants";
import { normalizarTexto } from "@/lib/utils";
import { buscarPracasPedagioNaRota, custoPedagioTotal, type PracaPedagioNaRota } from "@/lib/pedagio";

// Os 10 campos booleanos de serviço que existem em postos_gf — usados como
// denominador fixo do score (mesma contagem do Streamlit: n_servicos_max).
const CAMPOS_SERVICO = [
  "funciona_24h",
  "pista_caminhao",
  "arla",
  "conveniencia",
  "conveniencia_am_pm",
  "possui_restaurante",
  "possui_banheiro",
  "possui_estacionamento",
  "possui_troca_oleo",
  "possui_internet",
] as const;

function contarServicos(posto: Record<string, unknown>) {
  return CAMPOS_SERVICO.reduce((n, campo) => n + (posto[campo] ? 1 : 0), 0);
}

export async function buscarSugestoesLocalAcao(texto: string): Promise<SugestaoGeocoding[]> {
  return geocodificar(texto);
}

export type PostoComScore = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  bandeira: string | null;
  lat: number;
  lon: number;
  precos: { combustivel: string; preco: number; dataRef: string }[];
  score: ScorePosto;
  desvioKm?: number;
  kmNaRota?: number;
  // Fase 27.140 — "proprio" (postos_gf do cliente) ou "anp" (base pública
  // nacional, sem vínculo com o cliente — preço é a estimativa oficial ANP,
  // não um preço negociado). Ver comentário completo em
  // carregarPostosAnpPorFiltro/montarPostosAnp mais abaixo.
  origem: "proprio" | "anp";
};

async function carregarPostosComCoordenadas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  filtro?: { uf?: string; municipioContem?: string }
) {
  let query = supabase
    .from("postos_gf")
    .select(
      "cnpj, razao_social, municipio, uf, bandeira, lat, lon, ativo, funciona_24h, pista_caminhao, arla, conveniencia, conveniencia_am_pm, possui_restaurante, possui_banheiro, possui_estacionamento, possui_troca_oleo, possui_internet"
    )
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .not("lat", "is", null)
    .not("lon", "is", null);

  if (filtro?.uf) query = query.eq("uf", filtro.uf);
  if (filtro?.municipioContem) query = query.ilike("municipio", `%${filtro.municipioContem}%`);

  const { data, error } = await query.limit(5000);
  if (error || !data) return [];
  return data;
}

async function carregarPrecosPorCnpj(supabase: Awaited<ReturnType<typeof createClient>>, cnpjs: string[]) {
  const mapa = new Map<string, { combustivel: string; preco: number; dataRef: string }[]>();
  if (cnpjs.length === 0) return mapa;

  const { data } = await supabase
    .from("historico_precos")
    .select("cnpj, combustivel, preco, data_ref")
    .in("cnpj", cnpjs)
    .order("data_ref", { ascending: false });

  const vistoPorChave = new Set<string>();
  for (const linha of data ?? []) {
    const chave = `${linha.cnpj}__${linha.combustivel}`;
    if (vistoPorChave.has(chave)) continue; // já pegamos o mais recente dessa combinação
    vistoPorChave.add(chave);
    const lista = mapa.get(linha.cnpj) ?? [];
    lista.push({ combustivel: linha.combustivel, preco: linha.preco, dataRef: linha.data_ref });
    mapa.set(linha.cnpj, lista);
  }
  return mapa;
}

// Fase 27.140 — pedido do Daniel: "As consultas de roteirização estão
// sendo realizadas somente nos postos_gf. As consultas precisam trazer os
// postos ANP também" (confirmado: as 3 consultas — Por UF/Município,
// Consulta por Posto e Roteirizador Inteligente). postos_gf é a base
// PRÓPRIA do cliente (planilha/self-service/meios de pagamento — hoje só
// alguns milhares de linhas no total, distribuídas entre poucos clientes);
// anp_postos é a base pública nacional da ANP (~35 mil postos). Até aqui só
// o Roteirizador Inteligente tinha algum uso da base ANP, e mesmo assim só
// como FALLBACK quando a rede própria não tinha NENHUM candidato no
// corredor (Fase 27.17) — as outras 2 consultas nunca chegavam a olhar pra
// anp_postos, apesar do aviso na tela dizer que "esta consulta já funciona
// com a base pública de preços ANP". As 3 funções abaixo passam a MESCLAR
// sempre os dois conjuntos (não só quando postos_gf está vazio), com dedup
// por CNPJ normalizado — se o mesmo posto aparece nas duas bases (comum
// depois da Fase 27.137, que casa o cadastro do posto com anp_postos), fica
// só a versão postos_gf (mais rica: preço negociado/importado + os 10
// campos de serviço, que a base pública não tem).

// Todas as categorias de combustível que a ANP usa no relatório oficial —
// derivado do de-para (PRODUTO_PARA_CATEGORIA_ANP) pra nunca ficar
// dessincronizado dele.
const CATEGORIAS_ANP = Array.from(new Set(Object.values(PRODUTO_PARA_CATEGORIA_ANP)));

// Limite de segurança pra consulta de anp_postos por UF sem município.
// Fase 27.140 tinha isso em 1000 "pra não carregar tudo numa tela só" — o
// Daniel testou com MG (o maior estado da base, 4.500 postos ativos) e viu
// a consulta cortada bem antes do fim: "tem muito mais que isso". 6.000
// cobre folgado o maior estado hoje (MG=4.500, SP=4.013, RS=2.772...) com
// margem pra base ANP crescer um pouco sem precisar mexer aqui de novo.
const LIMITE_POSTOS_ANP = 6000;

type PostoAnpBruto = {
  cnpj: string | null;
  razao_social: string | null;
  municipio: string | null;
  uf: string | null;
  bandeira: string | null;
  latitude: number | null;
  longitude: number | null;
};

async function carregarPostosAnpPorFiltro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filtro: { uf?: string; municipioContem?: string }
): Promise<PostoAnpBruto[]> {
  let query = supabase
    .from("anp_postos")
    .select("cnpj, razao_social, municipio, uf, bandeira, latitude, longitude")
    .eq("ativo", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .not("cnpj", "is", null);
  if (filtro.uf) query = query.eq("uf", filtro.uf);
  if (filtro.municipioContem) query = query.ilike("municipio", `%${filtro.municipioContem}%`);

  const { data } = await query.limit(LIMITE_POSTOS_ANP);
  return data ?? [];
}

type PrecosAnpEmLote = {
  porMunicipio: Map<string, Map<string, { preco: number; dataRef: string }>>; // chave: `${municipioNorm}__${estadoAnp}`
  porEstado: Map<string, Map<string, { preco: number; dataRef: string }>>; // chave: estadoAnp
  brasil: Map<string, { preco: number; dataRef: string }>;
};

// Preço oficial ANP (todas as categorias de uma vez) em lote, pros estados
// informados — mesma cascata município → estado → Brasil já usada em
// resolverPrecosVigentes (src/lib/precoVigente.ts), só que pra MUITOS
// postos ao mesmo tempo (evita 1 consulta por posto).
async function carregarPrecosAnpEmLote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estadosAnp: string[]
): Promise<PrecosAnpEmLote> {
  const porMunicipio: PrecosAnpEmLote["porMunicipio"] = new Map();
  const porEstado: PrecosAnpEmLote["porEstado"] = new Map();
  const brasil: PrecosAnpEmLote["brasil"] = new Map();

  if (estadosAnp.length > 0) {
    const { data: municData } = await supabase
      .from("anp_precos_referencia")
      .select("municipio, estado, produto, preco_medio, data_final")
      .eq("nivel", "municipio")
      .in("estado", estadosAnp)
      .in("produto", CATEGORIAS_ANP)
      .order("data_final", { ascending: false });
    for (const l of municData ?? []) {
      if (l.preco_medio == null) continue;
      const chave = `${l.municipio}__${l.estado}`;
      const mapa = porMunicipio.get(chave) ?? new Map();
      if (!mapa.has(l.produto)) mapa.set(l.produto, { preco: l.preco_medio, dataRef: l.data_final });
      porMunicipio.set(chave, mapa);
    }

    const { data: estData } = await supabase
      .from("anp_precos_referencia")
      .select("estado, produto, preco_medio, data_final")
      .eq("nivel", "estado")
      .in("estado", estadosAnp)
      .in("produto", CATEGORIAS_ANP)
      .order("data_final", { ascending: false });
    for (const l of estData ?? []) {
      if (l.preco_medio == null) continue;
      const mapa = porEstado.get(l.estado) ?? new Map();
      if (!mapa.has(l.produto)) mapa.set(l.produto, { preco: l.preco_medio, dataRef: l.data_final });
      porEstado.set(l.estado, mapa);
    }
  }

  const { data: brasilData } = await supabase
    .from("anp_precos_referencia")
    .select("produto, preco_medio, data_final")
    .eq("nivel", "brasil")
    .in("produto", CATEGORIAS_ANP)
    .order("data_final", { ascending: false });
  for (const l of brasilData ?? []) {
    if (l.preco_medio == null) continue;
    if (!brasil.has(l.produto)) brasil.set(l.produto, { preco: l.preco_medio, dataRef: l.data_final });
  }

  return { porMunicipio, porEstado, brasil };
}

// Monta os PostoComScore dos postos ANP que ainda não estão no conjunto
// (dedup por CNPJ normalizado, contra os postos_gf já carregados) — preço
// de cada categoria vem da cascata oficial ANP; sem nenhum dos 10 campos de
// serviço, porque a base pública não tem essa informação (score cai pro
// "sem serviço nenhum marcado", igual ao fallback que já existia no
// Roteirizador Inteligente).
function montarPostosAnp(
  postosAnp: PostoAnpBruto[],
  cnpjsJaPresentes: Set<string>,
  precosAnp: PrecosAnpEmLote
): PostoComScore[] {
  const resultado: PostoComScore[] = [];
  for (const p of postosAnp) {
    if (!p.cnpj || p.latitude == null || p.longitude == null) continue;
    const cnpjNorm = p.cnpj.replace(/\D/g, "");
    if (!cnpjNorm || cnpjsJaPresentes.has(cnpjNorm)) continue;
    cnpjsJaPresentes.add(cnpjNorm);

    const estadoAnp = p.uf ? UF_PARA_ESTADO_ANP[p.uf.toUpperCase()] : undefined;
    const municipioNorm = p.municipio ? normalizarTexto(p.municipio) : "";
    const mapaMunicipio = estadoAnp ? precosAnp.porMunicipio.get(`${municipioNorm}__${estadoAnp}`) : undefined;
    const mapaEstado = estadoAnp ? precosAnp.porEstado.get(estadoAnp) : undefined;

    const precos: { combustivel: string; preco: number; dataRef: string }[] = [];
    for (const categoria of CATEGORIAS_ANP) {
      const achado = mapaMunicipio?.get(categoria) ?? mapaEstado?.get(categoria) ?? precosAnp.brasil.get(categoria);
      if (achado) precos.push({ combustivel: categoria, preco: achado.preco, dataRef: achado.dataRef });
    }

    const precoMedio = precos.length ? precos.reduce((s, x) => s + x.preco, 0) / precos.length : null;
    resultado.push({
      cnpj: cnpjNorm,
      razaoSocial: p.razao_social,
      municipio: p.municipio,
      uf: p.uf,
      bandeira: p.bandeira,
      lat: Number(p.latitude),
      lon: Number(p.longitude),
      precos,
      score: calcularScorePosto({
        precoPosto: precoMedio,
        precoReferenciaAnp: null,
        servicosAtivos: 0,
        servicosTotal: CAMPOS_SERVICO.length,
      }),
      origem: "anp",
    });
  }
  return resultado;
}

// ── Modo "Por UF/Município" ──────────────────────────────────────────
export async function buscarPostosPorUfAcao(params: {
  empresaId: string;
  uf?: string;
  municipio?: string;
}): Promise<PostoComScore[]> {
  const supabase = await createClient();
  const postos = await carregarPostosComCoordenadas(supabase, params.empresaId, {
    uf: params.uf,
    municipioContem: params.municipio,
  });

  const precosPorCnpj = await carregarPrecosPorCnpj(
    supabase,
    postos.map((p) => p.cnpj)
  );

  const resultadoGf: PostoComScore[] = postos.map((p) => {
    const precos = precosPorCnpj.get(p.cnpj) ?? [];
    const precoMedio = precos.length ? precos.reduce((s, x) => s + x.preco, 0) / precos.length : null;
    return {
      cnpj: p.cnpj,
      razaoSocial: p.razao_social,
      municipio: p.municipio,
      uf: p.uf,
      bandeira: p.bandeira,
      lat: p.lat as number,
      lon: p.lon as number,
      precos,
      score: calcularScorePosto({
        precoPosto: precoMedio,
        precoReferenciaAnp: null, // sem ponto de referência único nesse modo
        servicosAtivos: contarServicos(p),
        servicosTotal: CAMPOS_SERVICO.length,
      }),
      origem: "proprio",
    };
  });

  // Fase 27.140 — mescla com a base pública ANP (ver comentário acima de
  // carregarPostosAnpPorFiltro). Só busca ANP quando o filtro tem algo
  // (UF ou município) — igual ao comportamento de antes pra postos_gf, que
  // também exige pelo menos a UF no formulário desta tela.
  if (params.uf || params.municipio) {
    const cnpjsJaPresentes = new Set(resultadoGf.map((p) => p.cnpj.replace(/\D/g, "")));
    const postosAnpBrutos = await carregarPostosAnpPorFiltro(supabase, {
      uf: params.uf,
      municipioContem: params.municipio,
    });
    const estadosAnp = Array.from(
      new Set(
        postosAnpBrutos.map((p) => (p.uf ? UF_PARA_ESTADO_ANP[p.uf.toUpperCase()] : undefined)).filter((x): x is string => !!x)
      )
    );
    const precosAnp = await carregarPrecosAnpEmLote(supabase, estadosAnp);
    const resultadoAnp = montarPostosAnp(postosAnpBrutos, cnpjsJaPresentes, precosAnp);
    return [...resultadoGf, ...resultadoAnp];
  }

  return resultadoGf;
}

// ── Modo "Consulta por Posto" ────────────────────────────────────────
export async function buscarPostoPorTermoAcao(params: {
  empresaId: string;
  termo: string;
}): Promise<PostoComScore[]> {
  const supabase = await createClient();
  const termoDigitos = params.termo.replace(/\D/g, "");
  const ehCnpj = termoDigitos.length >= 11;

  let query = supabase
    .from("postos_gf")
    .select(
      "cnpj, razao_social, municipio, uf, bandeira, lat, lon, funciona_24h, pista_caminhao, arla, conveniencia, conveniencia_am_pm, possui_restaurante, possui_banheiro, possui_estacionamento, possui_troca_oleo, possui_internet"
    )
    .eq("empresa_id", params.empresaId)
    .not("lat", "is", null)
    .not("lon", "is", null);

  query = ehCnpj ? query.ilike("cnpj", `%${termoDigitos}%`) : query.ilike("razao_social", `%${params.termo}%`);

  const { data: postosBrutos } = await query.limit(30);
  const postos = postosBrutos ?? [];

  const precosPorCnpj = await carregarPrecosPorCnpj(
    supabase,
    postos.map((p) => p.cnpj)
  );

  const resultadoGf: PostoComScore[] = postos.map((p) => {
    const precos = precosPorCnpj.get(p.cnpj) ?? [];
    const precoMedio = precos.length ? precos.reduce((s, x) => s + x.preco, 0) / precos.length : null;
    return {
      cnpj: p.cnpj,
      razaoSocial: p.razao_social,
      municipio: p.municipio,
      uf: p.uf,
      bandeira: p.bandeira,
      lat: p.lat as number,
      lon: p.lon as number,
      precos,
      score: calcularScorePosto({
        precoPosto: precoMedio,
        precoReferenciaAnp: null,
        servicosAtivos: contarServicos(p),
        servicosTotal: CAMPOS_SERVICO.length,
      }),
      origem: "proprio",
    };
  });

  // Fase 27.140 — mesma busca (CNPJ ou nome) também na base pública ANP,
  // mesclada com dedup por CNPJ (ver comentário acima de
  // carregarPostosAnpPorFiltro/montarPostosAnp).
  let queryAnp = supabase
    .from("anp_postos")
    .select("cnpj, razao_social, municipio, uf, bandeira, latitude, longitude")
    .eq("ativo", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .not("cnpj", "is", null);
  queryAnp = ehCnpj ? queryAnp.ilike("cnpj", `%${termoDigitos}%`) : queryAnp.ilike("razao_social", `%${params.termo}%`);
  const { data: postosAnpBrutos } = await queryAnp.limit(30);

  const cnpjsJaPresentes = new Set(resultadoGf.map((p) => p.cnpj.replace(/\D/g, "")));
  const estadosAnp = Array.from(
    new Set(
      (postosAnpBrutos ?? [])
        .map((p) => (p.uf ? UF_PARA_ESTADO_ANP[p.uf.toUpperCase()] : undefined))
        .filter((x): x is string => !!x)
    )
  );
  const precosAnp = await carregarPrecosAnpEmLote(supabase, estadosAnp);
  const resultadoAnp = montarPostosAnp(postosAnpBrutos ?? [], cnpjsJaPresentes, precosAnp);

  return [...resultadoGf, ...resultadoAnp];
}

export type ResultadoRotaCalculada = {
  distanciaKm: number;
  duracaoMin: number;
  linhaReta: boolean;
  coordenadas: Ponto[];
  // Fase Seleção-Manual-de-Postos (28/07/2026) — antes esta função devolvia
  // `postosProximos: PostoComScore[]` (só informativo, sem preço filtrado
  // por combustível nem grade comparável). Pedido do Daniel: o modo "Por
  // Rota" virou o "roteirizador manual" — o gestor clica nos postos do
  // corredor pra montar a própria lista de paradas — e pra isso precisa do
  // mesmo formato `CandidatoAbastecimento` usado no Roteirizador Inteligente
  // (preço do combustível escolhido, grade, km/desvio), calculado pela MESMA
  // função (montarCandidatosNoCorredor) — evita ter duas lógicas de
  // montagem de candidato divergentes.
  candidatos: CandidatoAbastecimento[];
  usouFallbackAnp: boolean;
  // Fase Pedágios — praças de pedágio encontradas no corredor da rota
  // (mesmo raio/técnica de bounding box usada pra achar postos), pra
  // plotar no mapa e mostrar como referência de custo ao usuário.
  pracasPedagio: PracaPedagioNaRota[];
};

// ── Modo "Por Rota" (roteirizador manual) ─────────────────────────────
// Fase Seleção-Manual-de-Postos — pedido de um gestor de frota (via
// Daniel): ver os postos no corredor da rota e escolher, clicando, em quais
// o motorista vai abastecer — sem depender do algoritmo guloso do
// Roteirizador Inteligente. Agora exige `combustivel` (precisa saber qual
// preço comparar em cada posto) — o cálculo de litros/custo/viabilidade por
// parada acontece 100% no client, via calcularAbastecimentoParaSelecao
// (src/lib/roteirizacaoAlgoritmo.ts), a cada clique do gestor.
export async function calcularRotaEPostosAcao(params: {
  empresaId: string;
  origem: Ponto;
  destino: Ponto;
  paradas?: Ponto[];
  combustivel: string;
  raioKm?: number;
}): Promise<ResultadoRotaCalculada> {
  const supabase = await createClient();
  const raioKm = params.raioKm ?? 5;

  const rota = await calcularRotaOsrm(params.origem, params.destino, params.paradas ?? []);
  const acumuladas = distanciasAcumuladas(rota.coordenadas);

  const { candidatos, usouFallbackAnp } = await montarCandidatosNoCorredor(supabase, {
    empresaId: params.empresaId,
    coordenadasRota: rota.coordenadas,
    acumuladas,
    combustivel: params.combustivel,
    raioCorredorKm: raioKm,
  });

  const pracasPedagio = await buscarPracasPedagioNaRota(supabase, rota.coordenadas, acumuladas);

  return {
    distanciaKm: Math.round(rota.distanciaKm * 10) / 10,
    duracaoMin: Math.round(rota.duracaoMin),
    linhaReta: rota.linhaReta,
    coordenadas: rota.coordenadas,
    candidatos,
    usouFallbackAnp,
    pracasPedagio,
  };
}

export type ComparativoEstrategia = {
  chave: string;
  nome: string;
  icone: string;
  custoTotal: number;
  litrosTotal: number;
  numParadas: number;
  gradeMedia: "A" | "B" | "C" | "D";
  precoMedioPago: number | null;
};

export type ResultadoRoteirizacao = {
  distanciaKm: number;
  duracaoMin: number;
  linhaReta: boolean;
  coordenadas: Ponto[];
  paradas: ParadaSugerida[];
  litrosTotal: number;
  custoTotal: number;
  candidatosEncontrados: number;
  // Fase Seleção-Manual-de-Postos (28/07/2026) — lista COMPLETA de
  // candidatos do corredor (não só os que o algoritmo escolheu), ordenada
  // por km — o client usa pra deixar o gestor ver todos os postos e
  // ajustar a seleção sugerida (marcar/desmarcar), recalculando ao vivo
  // com calcularAbastecimentoParaSelecao (roteirizacaoAlgoritmo.ts), sem
  // precisar de uma nova chamada ao servidor a cada clique.
  candidatos: CandidatoAbastecimento[];
  // Comparativo das 4 estratégias com os mesmos candidatos (sem recalcular
  // rota/OSRM) — alimenta a aba "Custo da Viagem".
  comparativoEstrategias: ComparativoEstrategia[];
  // Referências de preço para a projeção de economia: média dos postos GF
  // candidatos no corredor da rota, e estimativa oficial ANP do estado mais
  // representado entre esses postos.
  precoMedioGf: number | null;
  precoReferenciaAnp: number | null;
  ufReferencia: string | null;
  // Fase 27.17, ampliado na Fase 27.140 — true quando pelo menos 1 dos
  // candidatos do corredor veio da base pública anp_postos (preço é a
  // estimativa oficial ANP, não um preço negociado). Antes só ficava true
  // quando a rede própria não tinha NENHUM candidato (fallback); agora os
  // dois conjuntos são sempre mesclados, então também fica true quando a
  // rede própria tem candidatos mas a base ANP completa com mais opções no
  // mesmo corredor (ver comentário completo em calcularRoteirizacaoAcao).
  usouFallbackAnp: boolean;
  // Fase Pedágios — praças de pedágio no corredor da rota, pra plotar no
  // mapa e somar ao custo total da viagem. `custoPedagioEstimado` usa a
  // tarifa de carro/utilitário (`valor_carro`) — o cadastro de veículo desta
  // tela ainda não informa nº de eixos, então caminhões (tarifado por eixo,
  // normalmente mais caro) não têm estimativa exata aqui ainda; a lista
  // completa de praças (com valor por eixo também) fica disponível pra quem
  // quiser calcular à mão.
  pracasPedagio: PracaPedagioNaRota[];
  custoPedagioEstimado: number;
};

// Fase Seleção-Manual-de-Postos (28/07/2026) — a lógica de "quais postos
// existem no corredor da rota, com que preço/grade pro combustível
// escolhido" foi extraída pra cá (antes vivia só dentro de
// calcularRoteirizacaoAcao) pra ser compartilhada com calcularRotaEPostosAcao
// (modo "Por Rota"/manual, ver acima) — as duas telas precisam exatamente do
// mesmo CandidatoAbastecimento; a diferença é só quem decide onde parar: o
// algoritmo guloso (otimizarAbastecimento) ou o próprio gestor clicando
// (calcularAbastecimentoParaSelecao, em src/lib/roteirizacaoAlgoritmo.ts).
async function montarCandidatosNoCorredor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    empresaId: string;
    coordenadasRota: Ponto[];
    acumuladas: number[];
    combustivel: string;
    raioCorredorKm?: number;
  }
): Promise<{ candidatos: CandidatoAbastecimento[]; usouFallbackAnp: boolean }> {
  const RAIO_CORREDOR_KM = params.raioCorredorKm ?? 5; // fixo, igual ao Streamlit (_MAX_DEV)

  // Fase 27.21 — boxes por pedaço da rota (não mais um box único cobrindo
  // do início ao fim), reaproveitados tanto na consulta de postos_gf quanto
  // no fallback ANP mais abaixo. Ver comentário de construirBoundingBoxesDaRota.
  const margem = RAIO_CORREDOR_KM / 100;
  const boxesRota = construirBoundingBoxesDaRota(params.coordenadasRota, params.acumuladas, margem);

  const postosBrutosPorBox = await Promise.all(
    boxesRota.map((box) =>
      supabase
        .from("postos_gf")
        .select(
          "cnpj, razao_social, municipio, uf, bandeira, lat, lon, funciona_24h, pista_caminhao, arla, conveniencia, conveniencia_am_pm, possui_restaurante, possui_banheiro, possui_estacionamento, possui_troca_oleo, possui_internet"
        )
        .eq("empresa_id", params.empresaId)
        .eq("ativo", true)
        .not("lat", "is", null)
        .not("lon", "is", null)
        .gte("lat", box.minLat)
        .lte("lat", box.maxLat)
        .gte("lon", box.minLon)
        .lte("lon", box.maxLon)
        .limit(3000)
    )
  );
  // Pedaços vizinhos podem se sobrepor (mesmo posto cai em dois boxes) — dedup por cnpj.
  const postosBrutos = Array.from(
    new Map(postosBrutosPorBox.flatMap((r) => r.data ?? []).map((p) => [p.cnpj, p])).values()
  );

  const candidatosBrutos = postosBrutos
    .map((p) => {
      const { km, desvioKm } = posicaoNaRotaKm(
        { lat: p.lat as number, lon: p.lon as number },
        params.coordenadasRota,
        params.acumuladas
      );
      return { ...p, km, desvioKm };
    })
    .filter((p) => p.desvioKm <= RAIO_CORREDOR_KM);

  const precosPorCnpj = await carregarPrecosPorCnpj(
    supabase,
    candidatosBrutos.map((p) => p.cnpj)
  );

  // Só entram os postos que têm preço registrado para o combustível
  // escolhido — sem preço, não dá para pontuar nem decidir se compensa
  // parar ali (nem no algoritmo automático, nem na seleção manual).
  let candidatos: CandidatoAbastecimento[] = candidatosBrutos
    .map((p) => {
      const precoRegistrado = (precosPorCnpj.get(p.cnpj) ?? []).find(
        (x) => x.combustivel.toLowerCase() === params.combustivel.toLowerCase()
      );
      if (!precoRegistrado) return null;
      const score = calcularScorePosto({
        precoPosto: precoRegistrado.preco,
        precoReferenciaAnp: null,
        servicosAtivos: contarServicos(p),
        servicosTotal: CAMPOS_SERVICO.length,
      });
      return {
        cnpj: p.cnpj,
        km: p.km,
        desvioKm: p.desvioKm,
        preco: precoRegistrado.preco,
        grade: score.grade,
        label: p.razao_social ?? p.cnpj,
        lat: p.lat as number,
        lon: p.lon as number,
        bandeira: p.bandeira,
        uf: p.uf as string | null,
        origem: "proprio" as const,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Fase 27.17 — achado real: cliente novo (sem nenhum posto próprio
  // cadastrado em postos_gf — só 1 empresa no banco tinha postos_gf
  // preenchido) não conseguia usar a Roteirização de jeito nenhum, mesmo
  // sendo uma feature que não deveria depender de onboarding prévio. Busca
  // no cadastro público da ANP (anp_postos, ~35 mil postos com coordenadas,
  // sem vínculo de empresa) + a estimativa oficial de preço da ANP
  // (município → estado → Brasil, mesma cascata de resolverPrecosVigentes —
  // só que em lote aqui, porque são dezenas/centenas de candidatos de uma
  // vez, não um posto só).
  //
  // Fase 27.140 — pedido do Daniel: antes só buscava ANP quando a rede
  // própria não tinha NENHUM candidato no corredor (fallback); agora
  // SEMPRE busca e mescla os dois conjuntos (dedup por CNPJ, priorizando o
  // candidato "próprio" quando o mesmo posto aparece nas duas bases) — o
  // Roteirizador Inteligente passa a considerar as duas fontes na mesma
  // rota, não só uma ou outra.
  let usouFallbackAnp = false;
  {
    const categoriaAnp = PRODUTO_PARA_CATEGORIA_ANP[params.combustivel];
    if (categoriaAnp) {
      // CNPJs já cobertos pelos candidatos "próprios" — a base ANP só
      // completa o que a rede própria ainda não tem nesse corredor, nunca
      // duplica o mesmo posto.
      const cnpjsProprios = new Set(candidatos.map((c) => c.cnpj.replace(/\D/g, "")));

      const anpPostosBrutosPorBox = await Promise.all(
        boxesRota.map((box) =>
          supabase
            .from("anp_postos")
            .select("cnpj, razao_social, municipio, uf, bandeira, latitude, longitude")
            .eq("ativo", true)
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .gte("latitude", box.minLat)
            .lte("latitude", box.maxLat)
            .gte("longitude", box.minLon)
            .lte("longitude", box.maxLon)
            .limit(3000)
        )
      );
      const anpPostosBrutos = Array.from(
        new Map(
          anpPostosBrutosPorBox
            .flatMap((r) => r.data ?? [])
            .filter((p) => p.cnpj && !cnpjsProprios.has(p.cnpj.replace(/\D/g, "")))
            .map((p) => [p.cnpj ?? `${p.latitude}_${p.longitude}`, p])
        ).values()
      );

      const candidatosAnpBrutos = anpPostosBrutos
        .map((p) => {
          const { km, desvioKm } = posicaoNaRotaKm(
            { lat: Number(p.latitude), lon: Number(p.longitude) },
            params.coordenadasRota,
            params.acumuladas
          );
          return { ...p, km, desvioKm };
        })
        .filter((p) => p.desvioKm <= RAIO_CORREDOR_KM);

      const estadosNoCorredor = Array.from(
        new Set(
          candidatosAnpBrutos
            .map((p) => (p.uf ? UF_PARA_ESTADO_ANP[p.uf.toUpperCase()] : undefined))
            .filter((x): x is string => !!x)
        )
      );

      const precoPorMunicipio = new Map<string, number>();
      const precoPorEstado = new Map<string, number>();
      let precoBrasil: number | null = null;

      if (estadosNoCorredor.length > 0) {
        const { data: municData } = await supabase
          .from("anp_precos_referencia")
          .select("municipio, estado, preco_medio, data_final")
          .eq("nivel", "municipio")
          .eq("produto", categoriaAnp)
          .in("estado", estadosNoCorredor)
          .order("data_final", { ascending: false });
        for (const l of municData ?? []) {
          const chave = `${l.municipio}__${l.estado}`;
          if (!precoPorMunicipio.has(chave) && l.preco_medio != null) precoPorMunicipio.set(chave, l.preco_medio);
        }

        const { data: estData } = await supabase
          .from("anp_precos_referencia")
          .select("estado, preco_medio, data_final")
          .eq("nivel", "estado")
          .eq("produto", categoriaAnp)
          .in("estado", estadosNoCorredor)
          .order("data_final", { ascending: false });
        for (const l of estData ?? []) {
          if (!precoPorEstado.has(l.estado) && l.preco_medio != null) precoPorEstado.set(l.estado, l.preco_medio);
        }
      }

      const { data: brasilData } = await supabase
        .from("anp_precos_referencia")
        .select("preco_medio")
        .eq("nivel", "brasil")
        .eq("produto", categoriaAnp)
        .order("data_final", { ascending: false })
        .limit(1)
        .maybeSingle();
      precoBrasil = brasilData?.preco_medio ?? null;

      const candidatosAnp = candidatosAnpBrutos
        .map((p) => {
          const estadoAnp = p.uf ? UF_PARA_ESTADO_ANP[p.uf.toUpperCase()] : undefined;
          const municipioNorm = p.municipio ? normalizarTexto(p.municipio) : "";
          const preco =
            (estadoAnp ? precoPorMunicipio.get(`${municipioNorm}__${estadoAnp}`) : undefined) ??
            (estadoAnp ? precoPorEstado.get(estadoAnp) : undefined) ??
            precoBrasil ??
            null;
          // anp_postos.cnpj é opcional na base pública (alguns registros
          // antigos não têm) — sem cnpj não dá pra usar como identificador
          // único do candidato, então descarta junto com quem não achou preço.
          if (preco == null || !p.cnpj) return null;
          const score = calcularScorePosto({
            precoPosto: preco,
            precoReferenciaAnp: null,
            servicosAtivos: 0,
            servicosTotal: CAMPOS_SERVICO.length,
          });
          return {
            cnpj: p.cnpj,
            km: p.km,
            desvioKm: p.desvioKm,
            preco,
            grade: score.grade,
            label: p.razao_social ?? p.cnpj,
            lat: Number(p.latitude),
            lon: Number(p.longitude),
            bandeira: p.bandeira,
            uf: p.uf as string | null,
            origem: "anp" as const,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

      // Mescla — não substitui — os candidatos "próprios" já encontrados.
      candidatos = [...candidatos, ...candidatosAnp];
      usouFallbackAnp = candidatosAnp.length > 0;
    }
  }

  return { candidatos: candidatos.sort((a, b) => a.km - b.km), usouFallbackAnp };
}

// ── Modo "Roteirização" (planejamento com veículo) ────────────────────
export async function calcularRoteirizacaoAcao(params: {
  empresaId: string;
  origem: Ponto;
  destino: Ponto;
  paradas?: Ponto[];
  veiculo: {
    capacidadeTanqueL: number;
    autonomiaKmPorL: number;
    combustivel: string;
    combustivelInicialL?: number;
  };
  perfilChave: string;
}): Promise<ResultadoRoteirizacao> {
  const supabase = await createClient();
  const perfil = PERFIS_PESO.find((p) => p.chave === params.perfilChave) ?? PERFIS_PESO[1];

  const rota = await calcularRotaOsrm(params.origem, params.destino, params.paradas ?? []);
  const acumuladas = distanciasAcumuladas(rota.coordenadas);

  const { candidatos, usouFallbackAnp } = await montarCandidatosNoCorredor(supabase, {
    empresaId: params.empresaId,
    coordenadasRota: rota.coordenadas,
    acumuladas,
    combustivel: params.veiculo.combustivel,
  });

  const paradas = otimizarAbastecimento({
    candidatos,
    capacidadeTanqueL: params.veiculo.capacidadeTanqueL,
    autonomiaKmPorL: params.veiculo.autonomiaKmPorL,
    distanciaTotalRotaKm: rota.distanciaKm,
    pesos: { preco: perfil.preco, score: perfil.score, desvio: perfil.desvio },
    fillMode: perfil.fillMode,
    combustivelInicialL: params.veiculo.combustivelInicialL,
  });

  // ── Comparativo das 4 estratégias ──────────────────────────────────
  // Reaproveita os MESMOS candidatos já buscados (rota e postos não mudam
  // entre estratégias, só os pesos do otimizador) — sem custo extra de
  // OSRM/banco, só reprocessa o algoritmo guloso mais 3 vezes.
  const GRADE_VALOR: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
  const VALOR_GRADE: Record<number, "A" | "B" | "C" | "D"> = { 4: "A", 3: "B", 2: "C", 1: "D" };
  const comparativoEstrategias: ComparativoEstrategia[] = PERFIS_PESO.map((p) => {
    const paradasP =
      p.chave === perfil.chave
        ? paradas
        : otimizarAbastecimento({
            candidatos,
            capacidadeTanqueL: params.veiculo.capacidadeTanqueL,
            autonomiaKmPorL: params.veiculo.autonomiaKmPorL,
            distanciaTotalRotaKm: rota.distanciaKm,
            pesos: { preco: p.preco, score: p.score, desvio: p.desvio },
            fillMode: p.fillMode,
            combustivelInicialL: params.veiculo.combustivelInicialL,
          });
    const custoTotalP = Math.round(paradasP.reduce((s, x) => s + x.custoAbastecimento, 0) * 100) / 100;
    const litrosTotalP = paradasP.reduce((s, x) => s + x.litrosSugeridos, 0);
    const notas = paradasP.map((x) => GRADE_VALOR[x.grade ?? "C"] ?? 2);
    const notaMedia = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 2;
    return {
      chave: p.chave,
      nome: p.nome,
      icone: p.icone,
      custoTotal: custoTotalP,
      litrosTotal: litrosTotalP,
      numParadas: paradasP.length,
      gradeMedia: VALOR_GRADE[Math.round(notaMedia)] ?? "C",
      precoMedioPago: litrosTotalP > 0 ? Math.round((custoTotalP / litrosTotalP) * 1000) / 1000 : null,
    };
  });

  // ── Referências de preço (comparativo de preços + projeção de economia) ──
  const precosCandidatos = candidatos.map((c) => c.preco).filter((p) => Number.isFinite(p));
  const precoMedioGf =
    precosCandidatos.length > 0
      ? Math.round((precosCandidatos.reduce((s, p) => s + p, 0) / precosCandidatos.length) * 1000) / 1000
      : null;

  // UF mais representada entre os candidatos do corredor — usada como
  // referência de estado para a estimativa oficial ANP (não temos a UF de
  // origem/destino, só coordenadas, então aproximamos pela UF dos postos
  // que efetivamente concorrem nesta rota).
  let ufReferencia: string | null = null;
  const contagemUf = new Map<string, number>();
  for (const c of candidatos) {
    if (!c.uf) continue;
    contagemUf.set(c.uf, (contagemUf.get(c.uf) ?? 0) + 1);
  }
  let maxUfN = 0;
  for (const [uf, n] of contagemUf) {
    if (n > maxUfN) {
      maxUfN = n;
      ufReferencia = uf;
    }
  }

  let precoReferenciaAnp: number | null = null;
  const categoriaAnp = PRODUTO_PARA_CATEGORIA_ANP[params.veiculo.combustivel];
  const estadoAnp = ufReferencia ? UF_PARA_ESTADO_ANP[ufReferencia.toUpperCase()] : undefined;
  if (categoriaAnp && estadoAnp) {
    const { data: refAnp } = await supabase
      .from("anp_precos_referencia")
      .select("preco_medio")
      .eq("nivel", "estado")
      .eq("estado", estadoAnp)
      .eq("produto", categoriaAnp)
      .order("data_final", { ascending: false })
      .limit(1)
      .maybeSingle();
    precoReferenciaAnp = refAnp?.preco_medio ?? null;
  }

  const pracasPedagio = await buscarPracasPedagioNaRota(supabase, rota.coordenadas, acumuladas);
  const custoPedagioEstimado = Math.round(custoPedagioTotal(pracasPedagio, "carro") * 100) / 100;

  return {
    distanciaKm: Math.round(rota.distanciaKm * 10) / 10,
    duracaoMin: Math.round(rota.duracaoMin),
    linhaReta: rota.linhaReta,
    coordenadas: rota.coordenadas,
    paradas,
    litrosTotal: paradas.reduce((s, p) => s + p.litrosSugeridos, 0),
    custoTotal: Math.round(paradas.reduce((s, p) => s + p.custoAbastecimento, 0) * 100) / 100,
    candidatosEncontrados: candidatos.length,
    candidatos,
    comparativoEstrategias,
    precoMedioGf,
    precoReferenciaAnp,
    ufReferencia,
    usouFallbackAnp,
    pracasPedagio,
    custoPedagioEstimado,
  };
}

// ── Rotas Salvas ──────────────────────────────────────────────────────
export async function salvarRotaAcao(params: {
  nome: string;
  tipo: "estado" | "rota" | "busca" | "roteirizacao";
  empresaId: string | null;
  dados: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { erro: "Sessão expirada, faça login novamente." };

  const id = crypto.randomUUID();
  const { error } = await supabase.from("rotas_salvas").insert({
    id,
    usuario_email: user.email,
    empresa_id: params.empresaId,
    nome: params.nome.trim() || "Consulta sem nome",
    tipo: params.tipo,
    dados: params.dados as Json,
    criado_em: new Date().toISOString(),
  });

  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/roteirizacao/salvas");
  return { erro: undefined, id };
}

export async function excluirRotaSalvaAcao(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("rotas_salvas").delete().eq("id", id).eq("usuario_email", user?.email ?? "");
  revalidatePath("/roteirizacao/salvas");
}


// ── Detalhe do posto para o popup do mapa (clique no marcador) ────────
// Carregado sob demanda (só quando o usuário clica num posto no mapa), não
// junto com a lista — evitaria dezenas/centenas de consultas extras de uma
// vez só. Mostra o preço "vigente" de cada combustível já resolvido pela
// mesma cascata usada na tela de detalhe do posto: preço próprio do posto
// (historico_precos) sempre que existir, senão a estimativa oficial da ANP
// (município → estado → Brasil).
export type DetalhePostoMapa = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  bandeira: string | null;
  precos: PrecoResolvido[];
};

export async function buscarDetalhePostoParaMapaAcao(cnpj: string): Promise<DetalhePostoMapa | null> {
  const supabase = await createClient();

  const { data: posto } = await supabase
    .from("postos_gf")
    .select("cnpj, razao_social, municipio, uf, bandeira, empresa_id")
    .eq("cnpj", cnpj)
    .maybeSingle();

  if (posto) {
    const { data: precosBrutos } = await supabase
      .from("historico_precos")
      .select("combustivel, preco, data_ref")
      .eq("cnpj", cnpj)
      .order("data_ref", { ascending: false });

    // Mantém só o registro mais recente por produto (ex: "Diesel S-10 Comum"
    // e "Diesel S-10 Aditivado" são produtos DIFERENTES, com preços
    // diferentes — não podem ser colapsados num só, mesmo que a ANP agrupe
    // os dois na mesma categoria de referência "OLEO DIESEL S10" pra fins de
    // comparação). `precosBrutos` já vem ordenado do mais recente pro mais
    // antigo, então o primeiro visto por produto é o vigente.
    const vistos = new Set<string>();
    const precosGf = (precosBrutos ?? []).filter((p) => {
      if (vistos.has(p.combustivel)) return false;
      vistos.add(p.combustivel);
      return true;
    });

    const precos = await resolverPrecosVigentes(
      supabase,
      { cnpj: posto.cnpj, empresaPostoId: posto.empresa_id, municipio: posto.municipio, uf: posto.uf },
      precosGf
    );

    return {
      cnpj: posto.cnpj,
      razaoSocial: posto.razao_social,
      municipio: posto.municipio,
      uf: posto.uf,
      bandeira: posto.bandeira,
      precos,
    };
  }

  // Fase 27.140 — achado real: depois de passar a mostrar postos da base
  // ANP no mapa (mesclados com postos_gf, ver comentário acima de
  // carregarPostosAnpPorFiltro), clicar num marcador que só existe na base
  // ANP caía direto no "Posto não encontrado" do popup — esta função só
  // olhava postos_gf. Fallback pra anp_postos: mesma cascata de preço
  // (resolverPrecosVigentes), sem CNPJ de meios de pagamento nem "Meus
  // Preços" (não fazem sentido pra um posto que não é cliente da
  // plataforma) — só a estimativa oficial ANP por município/estado/Brasil.
  const { data: postoAnp } = await supabase
    .from("anp_postos")
    .select("cnpj, razao_social, municipio, uf, bandeira")
    .eq("cnpj", cnpj)
    .maybeSingle();
  // anp_postos.cnpj é opcional na base pública (alguns registros antigos
  // não têm) — mas como acabamos de filtrar por .eq("cnpj", cnpj) com um
  // valor não-nulo, só cai aqui um registro que TEM cnpj; a checagem é só
  // pra o TypeScript entender isso (a coluna é nullable no schema).
  if (!postoAnp || !postoAnp.cnpj) return null;

  const precos = await resolverPrecosVigentes(
    supabase,
    { cnpj: postoAnp.cnpj, empresaPostoId: null, municipio: postoAnp.municipio, uf: postoAnp.uf },
    []
  );

  return {
    cnpj: postoAnp.cnpj,
    razaoSocial: postoAnp.razao_social,
    municipio: postoAnp.municipio,
    uf: postoAnp.uf,
    bandeira: postoAnp.bandeira,
    precos,
  };
}
