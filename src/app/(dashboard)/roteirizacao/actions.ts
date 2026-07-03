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
import { otimizarAbastecimento, type ParadaSugerida } from "@/lib/roteirizacaoAlgoritmo";
import { resolverPrecosVigentes, type PrecoResolvido } from "@/lib/precoVigente";
import { PRODUTO_PARA_CATEGORIA_ANP, UF_PARA_ESTADO_ANP } from "@/lib/constants";
import { normalizarTexto } from "@/lib/utils";

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
  if (postos.length === 0) return [];

  const precosPorCnpj = await carregarPrecosPorCnpj(
    supabase,
    postos.map((p) => p.cnpj)
  );

  return postos.map((p) => {
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
    };
  });
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

  const { data: postos } = await query.limit(30);
  if (!postos || postos.length === 0) return [];

  const precosPorCnpj = await carregarPrecosPorCnpj(
    supabase,
    postos.map((p) => p.cnpj)
  );

  return postos.map((p) => {
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
    };
  });
}

export type ResultadoRotaCalculada = {
  distanciaKm: number;
  duracaoMin: number;
  linhaReta: boolean;
  coordenadas: Ponto[];
  postosProximos: PostoComScore[];
};

// ── Modo "Por Rota" ───────────────────────────────────────────────────
export async function calcularRotaEPostosAcao(params: {
  empresaId: string;
  origem: Ponto;
  destino: Ponto;
  paradas?: Ponto[];
  raioKm?: number;
}): Promise<ResultadoRotaCalculada> {
  const supabase = await createClient();
  const raioKm = params.raioKm ?? 5;

  const rota = await calcularRotaOsrm(params.origem, params.destino, params.paradas ?? []);
  const acumuladas = distanciasAcumuladas(rota.coordenadas);

  // Pré-filtro por bounding box (evita varrer postos longe da rota).
  const lats = rota.coordenadas.map((p) => p.lat);
  const lons = rota.coordenadas.map((p) => p.lon);
  const margem = raioKm / 100; // ~1 grau ≈ 100 km, aproximação suficiente para o pré-filtro
  const minLat = Math.min(...lats) - margem;
  const maxLat = Math.max(...lats) + margem;
  const minLon = Math.min(...lons) - margem;
  const maxLon = Math.max(...lons) + margem;

  const { data: postosBrutos } = await supabase
    .from("postos_gf")
    .select(
      "cnpj, razao_social, municipio, uf, bandeira, lat, lon, funciona_24h, pista_caminhao, arla, conveniencia, conveniencia_am_pm, possui_restaurante, possui_banheiro, possui_estacionamento, possui_troca_oleo, possui_internet"
    )
    .eq("empresa_id", params.empresaId)
    .eq("ativo", true)
    .not("lat", "is", null)
    .not("lon", "is", null)
    .gte("lat", minLat)
    .lte("lat", maxLat)
    .gte("lon", minLon)
    .lte("lon", maxLon)
    .limit(3000);

  const candidatos = (postosBrutos ?? [])
    .map((p) => {
      const { km, desvioKm } = posicaoNaRotaKm({ lat: p.lat as number, lon: p.lon as number }, rota.coordenadas, acumuladas);
      return { ...p, km, desvioKm };
    })
    .filter((p) => p.desvioKm <= raioKm)
    .sort((a, b) => a.km - b.km);

  const precosPorCnpj = await carregarPrecosPorCnpj(
    supabase,
    candidatos.map((p) => p.cnpj)
  );

  const postosProximos: PostoComScore[] = candidatos.map((p) => {
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
      desvioKm: Math.round(p.desvioKm * 10) / 10,
      kmNaRota: Math.round(p.km * 10) / 10,
      score: calcularScorePosto({
        precoPosto: precoMedio,
        precoReferenciaAnp: null,
        servicosAtivos: contarServicos(p),
        servicosTotal: CAMPOS_SERVICO.length,
      }),
    };
  });

  return {
    distanciaKm: Math.round(rota.distanciaKm * 10) / 10,
    duracaoMin: Math.round(rota.duracaoMin),
    linhaReta: rota.linhaReta,
    coordenadas: rota.coordenadas,
    postosProximos,
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
  // Comparativo das 4 estratégias com os mesmos candidatos (sem recalcular
  // rota/OSRM) — alimenta a aba "Custo da Viagem".
  comparativoEstrategias: ComparativoEstrategia[];
  // Referências de preço para a projeção de economia: média dos postos GF
  // candidatos no corredor da rota, e estimativa oficial ANP do estado mais
  // representado entre esses postos.
  precoMedioGf: number | null;
  precoReferenciaAnp: number | null;
  ufReferencia: string | null;
  // Fase 27.17 — true quando a empresa não tem postos próprios (postos_gf)
  // com preço pro combustível escolhido nesse corredor, e os candidatos
  // vieram da base pública anp_postos + estimativa oficial ANP em vez da
  // rede própria do cliente (ver comentário mais abaixo em
  // calcularRoteirizacaoAcao).
  usouFallbackAnp: boolean;
};

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
  const RAIO_CORREDOR_KM = 5; // fixo, igual ao Streamlit (_MAX_DEV)

  const rota = await calcularRotaOsrm(params.origem, params.destino, params.paradas ?? []);
  const acumuladas = distanciasAcumuladas(rota.coordenadas);

  // Fase 27.21 — boxes por pedaço da rota (não mais um box único cobrindo
  // do início ao fim), reaproveitados tanto na consulta de postos_gf quanto
  // no fallback ANP mais abaixo. Ver comentário de construirBoundingBoxesDaRota.
  const margem = RAIO_CORREDOR_KM / 100;
  const boxesRota = construirBoundingBoxesDaRota(rota.coordenadas, acumuladas, margem);

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
      const { km, desvioKm } = posicaoNaRotaKm({ lat: p.lat as number, lon: p.lon as number }, rota.coordenadas, acumuladas);
      return { ...p, km, desvioKm };
    })
    .filter((p) => p.desvioKm <= RAIO_CORREDOR_KM);

  const precosPorCnpj = await carregarPrecosPorCnpj(
    supabase,
    candidatosBrutos.map((p) => p.cnpj)
  );

  // Só entram no algoritmo os postos que têm preço registrado para o
  // combustível escolhido do veículo — sem preço, não dá para pontuar nem
  // decidir se compensa parar ali.
  let candidatos = candidatosBrutos
    .map((p) => {
      const precoRegistrado = (precosPorCnpj.get(p.cnpj) ?? []).find(
        (x) => x.combustivel.toLowerCase() === params.veiculo.combustivel.toLowerCase()
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
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Fase 27.17 — achado real: cliente novo (sem nenhum posto próprio
  // cadastrado em postos_gf — só 1 empresa no banco tinha postos_gf
  // preenchido) não conseguia usar a Roteirização de jeito nenhum, mesmo
  // sendo uma feature que não deveria depender de onboarding prévio. Quando
  // a rede própria não tem NENHUM candidato com preço nesse corredor,
  // busca no cadastro público da ANP (anp_postos, ~35 mil postos com
  // coordenadas, sem vínculo de empresa) + a estimativa oficial de preço da
  // ANP (município → estado → Brasil, mesma cascata de resolverPrecosVigentes
  // — só que em lote aqui, porque são dezenas/centenas de candidatos de uma
  // vez, não um posto só).
  let usouFallbackAnp = false;
  if (candidatos.length === 0) {
    const categoriaAnp = PRODUTO_PARA_CATEGORIA_ANP[params.veiculo.combustivel];
    if (categoriaAnp) {
      const anpPostosBrutosPorBox = await Promise.all(
        boxesRota.map((box) =>
          supabase
            .from("anp_postos")
            .select("cnpj, razao_social, municipio, uf, bandeira, latitude, longitude")
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
          anpPostosBrutosPorBox.flatMap((r) => r.data ?? []).map((p) => [p.cnpj ?? `${p.latitude}_${p.longitude}`, p])
        ).values()
      );

      const candidatosAnpBrutos = anpPostosBrutos
        .map((p) => {
          const { km, desvioKm } = posicaoNaRotaKm(
            { lat: Number(p.latitude), lon: Number(p.longitude) },
            rota.coordenadas,
            acumuladas
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

      candidatos = candidatosAnpBrutos
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
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

      usouFallbackAnp = candidatos.length > 0;
    }
  }

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

  return {
    distanciaKm: Math.round(rota.distanciaKm * 10) / 10,
    duracaoMin: Math.round(rota.duracaoMin),
    linhaReta: rota.linhaReta,
    coordenadas: rota.coordenadas,
    paradas,
    litrosTotal: paradas.reduce((s, p) => s + p.litrosSugeridos, 0),
    custoTotal: Math.round(paradas.reduce((s, p) => s + p.custoAbastecimento, 0) * 100) / 100,
    candidatosEncontrados: candidatos.length,
    comparativoEstrategias,
    precoMedioGf,
    precoReferenciaAnp,
    ufReferencia,
    usouFallbackAnp,
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
    .select("cnpj, razao_social, municipio, uf, bandeira")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (!posto) return null;

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

  const precos = await resolverPrecosVigentes(supabase, { municipio: posto.municipio, uf: posto.uf }, precosGf);

  return {
    cnpj: posto.cnpj,
    razaoSocial: posto.razao_social,
    municipio: posto.municipio,
    uf: posto.uf,
    bandeira: posto.bandeira,
    precos,
  };
}
