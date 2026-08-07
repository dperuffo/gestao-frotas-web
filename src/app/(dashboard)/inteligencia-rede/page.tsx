import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ANP_PRECO_REFERENCIA_FALLBACK, ESTADO_PARA_UF, PRODUTO_PARA_CATEGORIA_ANP } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { GraficoCustoAnp } from "./_components/GraficoCustoAnp";
import { GraficoTopMunicipios } from "./_components/GraficoTopMunicipios";
import { GraficoSavingMensal } from "./_components/GraficoSavingMensal";
import { GraficoAlertasPorEstado } from "./_components/GraficoAlertasPorEstado";
import { GraficoCoberturaMacrorregiao } from "./_components/GraficoCoberturaMacrorregiao";
import { GraficoOportunidadesExpansao } from "./_components/GraficoOportunidadesExpansao";
import { ModoComparativo } from "./_components/ModoComparativo";
import MapaDensidadeLazy from "./_components/MapaDensidadeLazy";
import { AbasPainel } from "./_components/AbasPainel";
import { TendenciaSazonalidade } from "./_components/TendenciaSazonalidade";
import { EvolucaoTemporal } from "./_components/EvolucaoTemporal";
import { Operacional } from "./_components/Operacional";
import { CruzamentosAvancados } from "./_components/CruzamentosAvancados";
import { CoberturaDemanda } from "./_components/CoberturaDemanda";
import { PrecosPorMeioPagamento } from "./_components/PrecosPorMeioPagamento";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

// Macrorregiões brasileiras (agrupamento IBGE) e total de municípios de cada
// uma (fonte: IBGE) — usado só pra calcular % de cobertura da rede GF por
// região; não muda com frequência, então fica fixo aqui como no Streamlit
// de referência.
const REGIOES: Record<string, string[]> = {
  Norte: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};
const TOTAL_MUNICIPIOS_REGIAO: Record<string, number> = {
  Norte: 449,
  Nordeste: 1794,
  "Centro-Oeste": 467,
  Sudeste: 1668,
  Sul: 1191,
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarMoeda3(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function formatarInt(valor: number) {
  return valor.toLocaleString("pt-BR");
}

type SearchParams = { empresa?: string };

// Fase 27.151 — pedido do Daniel: "faz todo o sentido deixar na visão do
// cliente [Inteligência de Rede]. Não há nada lá que afete os
// relacionamentos criados". Passou de admin-only pra também disponível pro
// cliente (perfil "posto" continua de fora — postos_gf é a rede de postos
// QUE O CLIENTE pesquisou/cadastrou, não faz sentido pro posto revendedor).
//
// Importante: a tela em si sempre chamou RPCs com p_empresa_id opcional
// (null = "sem filtro"). Pra quem é admin, deixamos null mesmo (visão
// consolidada de toda a plataforma, como sempre foi). Pra cliente, agora
// resolvemos a empresa dele (resolverEmpresaAtual — mesmo padrão de
// /dashboard, /documentos etc.) e passamos o id em TODA RPC que aceita
// p_empresa_id — nunca deixamos null pra cliente, pra nunca depender só do
// RLS/checagem embutida na função (defesa em profundidade, mesmo espírito
// da Fase 27.2 documentada em resolverEmpresaAtual). As RPCs que ainda não
// têm parâmetro de empresa (postos_gf_por_uf, postos_gf_municipios_unicos,
// etc.) rodam como SECURITY INVOKER direto sobre postos_gf/
// abastecimentos_unificado — a RLS dessas tabelas (postos_gf_tenant_all,
// profrotas_abastecimentos_select, abastecimentos_externos_tenant_all) já
// restringe automaticamente pra só a própria empresa do cliente, então
// continuam seguras sem precisar de parâmetro extra.
export default async function InteligenciaRedePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { perfil, empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(
    supabase,
    empresaParam
  );

  const ehAdmin = perfil === "admin";
  const ehPosto = perfil === "posto";

  if (perfil == null || ehPosto) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela não está disponível pro seu perfil. Fale com um administrador se você
          precisa desses dados.
        </p>
      </div>
    );
  }

  // Admin não escolhe empresa (visão consolidada, sempre foi assim). Cliente
  // com mais de uma empresa (grupo econômico) precisa escolher antes de ver
  // qualquer dado — mesmo comportamento de /dashboard quando há mais de uma
  // empresa disponível.
  if (!ehAdmin && !empresaSelecionada) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Inteligência de Rede</h1>
          <p className="mt-1 text-sm text-slate-500">Selecione a empresa pra ver a rede de postos dela.</p>
        </div>
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue="" className="input text-sm">
              <option value="" disabled>
                Selecione…
              </option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Trocar
          </button>
        </form>
      </div>
    );
  }

  // Pra cliente, nunca deixa null (defesa em profundidade — ver comentário
  // acima da função). Pra admin, null = sem filtro (toda a plataforma).
  const empresaIdFiltro = ehAdmin ? null : (empresaSelecionada as string);

  // As tabelas de origem (postos_gf, anp_postos, historico_precos) já passam
  // de mil linhas — o PostgREST corta em 1000 por padrão quando se busca
  // linha a linha, então os totais aqui vêm de RPCs que agregam (ou, no caso
  // dos pontos do mapa, que pelo menos não aplicam esse corte) direto no
  // banco.
  const [
    { data: postosPorUfRaw },
    { data: anpPorUfRaw },
    { data: municipiosUnicosRaw },
    { data: precoPorCombustivelRaw },
    { count: totalPostos },
    { data: topMunicipiosRaw },
    { data: pontosMapaRaw },
    { data: evolucaoMensalRaw },
    { data: alertasRaw, error: alertasErro },
    { data: universoAvaliadoRaw, error: universoAvaliadoErro },
    { data: municipiosPorUfRaw },
    { data: distribuidorasPorUfRaw },
    { data: precosPorUfRaw },
    { data: serieTendenciaRaw },
    { data: volatilidadeMensalRaw },
    { data: historicoDetalhadoRaw },
    { data: precoRealPeriodoRaw },
    { data: precosMapaOperacionalRaw },
    { data: desvioAnpRaw },
    { data: servicosPostoRaw },
    { data: postosVisitadosRaw, error: postosVisitadosErro },
    { data: precosPorMeioPagamentoRaw },
  ] = await Promise.all([
    supabase.rpc("postos_gf_por_uf"),
    supabase.rpc("anp_postos_por_uf"),
    supabase.rpc("postos_gf_municipios_unicos"),
    supabase.rpc("preco_medio_por_combustivel", { p_empresa_id: empresaIdFiltro }),
    empresaIdFiltro
      ? supabase.from("postos_gf").select("cnpj", { count: "exact", head: true }).eq("empresa_id", empresaIdFiltro)
      : supabase.from("postos_gf").select("cnpj", { count: "exact", head: true }),
    supabase.rpc("postos_gf_top_municipios", { p_limit: 10 }),
    supabase.rpc("postos_gf_pontos_mapa", { p_empresa_id: empresaIdFiltro }),
    supabase.rpc("historico_precos_evolucao_mensal"),
    supabase.rpc("postos_gf_alertas_preco", { p_threshold: 0.05, p_empresa_id: empresaIdFiltro }),
    // threshold bem negativo = praticamente "sem filtro" -> serve só pra
    // saber quantos postos+combustível TÊM referência ANP resolvida (o
    // denominador do "% em alerta"), reaproveitando a mesma função.
    supabase.rpc("postos_gf_alertas_preco", { p_threshold: -100, p_empresa_id: empresaIdFiltro }),
    supabase.rpc("postos_gf_municipios_por_uf"),
    supabase.rpc("postos_gf_distribuidoras_por_uf"),
    supabase.rpc("preco_medio_por_combustivel_uf"),
    supabase.rpc("historico_precos_serie_uf_combustivel", { p_empresa_id: empresaIdFiltro }),
    supabase.rpc("historico_precos_volatilidade_mensal", { p_empresa_id: empresaIdFiltro }),
    supabase.rpc("historico_precos_detalhado", { p_empresa_id: empresaIdFiltro }),
    supabase.rpc("abastecimentos_preco_periodo"),
    supabase.rpc("postos_gf_precos_mapa"),
    supabase.rpc("postos_gf_desvio_anp", { p_empresa_id: empresaIdFiltro }),
    supabase.rpc("postos_gf_servicos", { p_empresa_id: empresaIdFiltro }),
    supabase.rpc("abastecimentos_postos_visitados", { p_empresa_id: empresaIdFiltro }),
    supabase.rpc("preco_medio_por_meio_pagamento", { p_empresa_id: empresaIdFiltro }),
  ]);

  // Preço do diesel S10 por estado (ANP) — usado só no score de oportunidade
  // de expansão; tabela pequena (~178 linhas em nível "estado"), não precisa
  // de RPC.
  const { data: dieselPorUfRaw } = await supabase
    .from("anp_precos_referencia")
    .select("estado, preco_medio")
    .eq("nivel", "estado")
    .eq("produto", "OLEO DIESEL S10");

  // Referência oficial ANP (nível Brasil, semana mais recente importada).
  const { data: semanaMaisRecente } = await supabase
    .from("anp_precos_referencia")
    .select("data_inicial, data_final")
    .eq("nivel", "brasil")
    .order("data_final", { ascending: false })
    .limit(1)
    .maybeSingle();

  let referenciaOficialPorProduto = new Map<string, number>();
  if (semanaMaisRecente) {
    const { data: referenciaSemana } = await supabase
      .from("anp_precos_referencia")
      .select("produto, preco_medio")
      .eq("nivel", "brasil")
      .eq("data_final", semanaMaisRecente.data_final);
    referenciaOficialPorProduto = new Map(
      (referenciaSemana ?? []).filter((r) => r.preco_medio != null).map((r) => [r.produto, r.preco_medio as number])
    );
  }

  function resolverReferencia(combustivel: string): number | null {
    const categoriaAnp = PRODUTO_PARA_CATEGORIA_ANP[combustivel];
    const referenciaOficial = categoriaAnp ? referenciaOficialPorProduto.get(categoriaAnp) : undefined;
    return referenciaOficial ?? ANP_PRECO_REFERENCIA_FALLBACK[combustivel] ?? null;
  }

  const municipiosUnicos = municipiosUnicosRaw ?? 0;
  const postosPorUf = new Map((postosPorUfRaw ?? []).map((r) => [r.uf, r.total]));
  const anpPorUf = new Map((anpPorUfRaw ?? []).map((r) => [r.uf, r.total]));
  const estadosComPosto = new Set(postosPorUf.keys());
  const coberturaBr = Math.round((estadosComPosto.size / 27) * 100);
  const totalGf = totalPostos ?? 0;

  // Cobertura por estado: postos_gf vs anp_postos (referência real, 35 mil+ registros).
  const cobertura = Array.from(postosPorUf.entries())
    .map(([uf, qtd]) => ({
      uf,
      postosGf: qtd,
      totalAnp: anpPorUf.get(uf) ?? 0,
      penetracao: anpPorUf.get(uf) ? (qtd / anpPorUf.get(uf)!) * 100 : 0,
    }))
    .sort((a, b) => b.postosGf - a.postosGf);

  // Preço médio da rede por combustível (já vem calculado do banco, com o
  // registro mais recente por posto+combustível).
  const precoPorCombustivel = (precoPorCombustivelRaw ?? []).map((r) => {
    const referencia = resolverReferencia(r.combustivel);
    const categoriaAnp = PRODUTO_PARA_CATEGORIA_ANP[r.combustivel];
    const ehOficial = categoriaAnp ? referenciaOficialPorProduto.has(categoriaAnp) : false;
    return {
      combustivel: r.combustivel,
      precoMedio: r.preco_medio,
      qtdPostos: r.qtd_postos,
      referencia,
      ehOficial,
      deltaPct: referencia ? ((r.preco_medio - referencia) / referencia) * 100 : null,
    };
  });

  // "Diesel Médio GF" do card executivo combina as variantes de diesel
  // (S-10/S-500, comum/aditivado) num único número — média ponderada pela
  // quantidade de postos de cada variante, não média simples entre elas.
  const itensDiesel = precoPorCombustivel.filter((p) => p.combustivel.toLowerCase().startsWith("diesel"));
  const somaPostosDiesel = itensDiesel.reduce((soma, p) => soma + p.qtdPostos, 0);
  const dieselGf =
    somaPostosDiesel > 0
      ? itensDiesel.reduce((soma, p) => soma + p.precoMedio * p.qtdPostos, 0) / somaPostosDiesel
      : 0;
  const dieselAnpRef =
    referenciaOficialPorProduto.get("OLEO DIESEL S10") ?? ANP_PRECO_REFERENCIA_FALLBACK["Diesel S10"];
  const deltaDieselPct = dieselGf > 0 && dieselAnpRef ? ((dieselGf - dieselAnpRef) / dieselAnpRef) * 100 : null;

  // Saving potencial/ano: se há preço de diesel real e a rede está abaixo do
  // ANP, projeta a economia real (diferença × 100L/semana × 52 semanas ×
  // postos). Sem dado de preço, usa uma estimativa conservadora de 15% de
  // saving — mesmo critério do painel executivo original.
  const savingPotencialAno =
    dieselGf > 0 && dieselAnpRef && dieselAnpRef > dieselGf
      ? (dieselAnpRef - dieselGf) * 100 * 52 * totalGf
      : 0.15 * 100 * 52 * totalGf;

  const topMunicipios = topMunicipiosRaw ?? [];
  const pontosMapa = (pontosMapaRaw ?? []).map((p) => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) }));
  const evolucaoMensal = (evolucaoMensalRaw ?? []).map((r) => ({
    mes: r.mes,
    combustivel: r.combustivel,
    precoMedio: r.preco_medio,
  }));
  const referenciasPorCombustivel: Record<string, number> = {};
  for (const combustivel of new Set(evolucaoMensal.map((e) => e.combustivel))) {
    const ref = resolverReferencia(combustivel);
    if (ref != null) referenciasPorCombustivel[combustivel] = ref;
  }

  // Alertas de preço: postos GF cujo preço está mais de 5% acima da
  // referência ANP (município → estado → Brasil, resolvido no banco).
  // Fase 05/08/2026 (achado real do Daniel: a aba aparecia com "0 postos
  // em alerta" mesmo havendo dado real no banco) — antes, um erro nessas
  // duas RPCs (timeout, etc.) virava silenciosamente `[]` sem nenhum
  // rastro; agora pelo menos loga no servidor pra dar pra diagnosticar
  // sem precisar reproduzir manualmente no banco.
  if (alertasErro) {
    console.error("[inteligencia-rede] falha ao buscar alertas de preço (ignorado, mostra 0):", alertasErro);
  }
  if (universoAvaliadoErro) {
    console.error("[inteligencia-rede] falha ao buscar universo avaliado de preço (ignorado, mostra 0):", universoAvaliadoErro);
  }
  const alertas = alertasRaw ?? [];
  const totalAvaliados = (universoAvaliadoRaw ?? []).length;
  const totalAlertas = alertas.length;
  const pctAlerta = totalAvaliados > 0 ? (totalAlertas / totalAvaliados) * 100 : 0;
  const piorDesvio = alertas.reduce((max, a) => Math.max(max, a.diff_pct), 0);
  const desvioMedio = totalAlertas > 0 ? alertas.reduce((soma, a) => soma + a.diff_pct, 0) / totalAlertas : 0;

  const alertasPorEstadoMap = new Map<string, { postosAlerta: number; piorDesvio: number }>();
  for (const a of alertas) {
    if (!a.uf) continue;
    const atual = alertasPorEstadoMap.get(a.uf) ?? { postosAlerta: 0, piorDesvio: 0 };
    atual.postosAlerta += 1;
    atual.piorDesvio = Math.max(atual.piorDesvio, a.diff_pct);
    alertasPorEstadoMap.set(a.uf, atual);
  }
  const alertasPorEstado = Array.from(alertasPorEstadoMap.entries())
    .map(([uf, v]) => ({ uf, ...v }))
    .sort((a, b) => b.postosAlerta - a.postosAlerta);

  const top20Alertas = alertas.slice(0, 20);

  // Cobertura por macrorregião: % dos municípios da região que têm ao menos
  // 1 posto GF (referência de total de municípios por região: IBGE).
  const municipiosPorUf = new Map((municipiosPorUfRaw ?? []).map((r) => [r.uf, r.municipios]));
  const coberturaMacrorregiao = Object.entries(REGIOES)
    .map(([regiao, ufs]) => {
      const postosGf = ufs.reduce((soma, uf) => soma + (postosPorUf.get(uf) ?? 0), 0);
      const municipiosComGf = ufs.reduce((soma, uf) => soma + (municipiosPorUf.get(uf) ?? 0), 0);
      const totalMunicipios = TOTAL_MUNICIPIOS_REGIAO[regiao] ?? 1;
      const estadosComGf = ufs.filter((uf) => postosPorUf.has(uf)).length;
      return {
        regiao,
        postosGf,
        municipiosComGf,
        totalMunicipios,
        coberturaPct: Math.round((municipiosComGf / totalMunicipios) * 1000) / 10,
        estadosComGf,
        totalUfs: ufs.length,
      };
    })
    .sort((a, b) => b.coberturaPct - a.coberturaPct);

  // Top oportunidades de expansão: UFs com baixa penetração GF + diesel ANP
  // caro pontuam mais alto — mesma fórmula do painel Executivo do Streamlit.
  const dieselPorUf = new Map(
    (dieselPorUfRaw ?? [])
      .filter((r) => r.preco_medio != null)
      .map((r) => [ESTADO_PARA_UF[r.estado] ?? r.estado, r.preco_medio as number])
  );
  const dieselMax = Math.max(1, ...Array.from(dieselPorUf.values()));
  const oportunidades = Array.from(anpPorUf.keys())
    .map((uf) => {
      const postosGf = postosPorUf.get(uf) ?? 0;
      const totalAnp = anpPorUf.get(uf) ?? 0;
      const penetracaoPct = totalAnp > 0 ? (postosGf / totalAnp) * 100 : 0;
      const dieselUf = dieselPorUf.get(uf) ?? null;
      const score = dieselUf != null ? (1 - Math.min(penetracaoPct / 100, 1)) * (dieselUf / dieselMax) * 100 : 0;
      return { uf, postosGf, penetracaoPct: Math.round(penetracaoPct * 100) / 100, dieselAnp: dieselUf, score: Math.round(score * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Modo Comparativo: contagem de postos com coordenada por UF (a partir
  // dos mesmos pontos já buscados pro mapa de densidade).
  const coordPorUf: Record<string, number> = {};
  for (const p of pontosMapa) {
    if (!p.uf) continue;
    coordPorUf[p.uf] = (coordPorUf[p.uf] ?? 0) + 1;
  }
  const distribuidorasPorUf = distribuidorasPorUfRaw ?? [];
  const precosPorUf = (precosPorUfRaw ?? []).map((r) => ({
    uf: r.uf,
    combustivel: r.combustivel,
    precoMedio: r.preco_medio,
    qtdPostos: r.qtd_postos,
  }));
  const municipiosPorUfObj = Object.fromEntries(municipiosPorUf.entries());
  const postosPorUfObj = Object.fromEntries(postosPorUf.entries());

  // Tendência × Sazonalidade: série mensal já vem agregada por UF+combustível
  // do banco (714 linhas) — pequena o bastante pra mandar inteira pro cliente
  // e deixar o filtro de combustível 100% reativo, sem round-trip.
  const serieTendencia = (serieTendenciaRaw ?? []).map((r) => ({
    mes: r.mes,
    uf: r.uf,
    combustivel: r.combustivel,
    precoMedio: r.preco_medio,
    qtd: r.qtd,
  }));
  const volatilidadeMensal = (volatilidadeMensalRaw ?? []).map((r) => ({
    mes: r.mes,
    combustivel: r.combustivel,
    volatilidade: r.volatilidade,
    qtd: r.qtd,
  }));

  // Evolução Temporal: histórico bruto (14 mil+ registros) mandado inteiro
  // pro cliente — sem corte de 1000 (RPC), pequeno o bastante pra filtrar e
  // agregar (tendência por UF, volatilidade, ranking de estabilidade) 100%
  // no navegador, sem round-trip por interação.
  const historicoDetalhado = (historicoDetalhadoRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    municipio: r.municipio,
    uf: r.uf,
    combustivel: r.combustivel,
    semana: r.semana,
    mes: r.mes,
    preco: r.preco,
  }));
  const precoRealPeriodo = (precoRealPeriodoRaw ?? []).map((r) => ({
    uf: r.uf,
    semana: r.semana,
    mes: r.mes,
    precoMedio: r.preco_medio,
    qtd: r.qtd,
  }));

  // Dashboard Operacional: mapa de preços, postos inconsistentes vs ANP e
  // score composto (preço 50% + serviços 30% + distância neutra 20%) por
  // região — os três alimentam abas diferentes dentro do mesmo painel.
  const precosMapaOperacional = (precosMapaOperacionalRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    municipio: r.municipio,
    uf: r.uf,
    combustivel: r.combustivel,
    preco: r.preco,
    lat: r.lat,
    lon: r.lon,
  }));
  const desvioAnp = (desvioAnpRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    municipio: r.municipio,
    uf: r.uf,
    combustivel: r.combustivel,
    precoGf: r.preco_gf,
    precoAnp: r.preco_anp,
    nivelAnp: r.nivel_anp,
    diffPct: r.diff_pct,
  }));
  const servicosPosto = (servicosPostoRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    arla: r.arla,
    funciona24h: r.funciona_24h,
    possuiBanheiro: r.possui_banheiro,
    possuiEstacionamento: r.possui_estacionamento,
    possuiInternet: r.possui_internet,
    possuiOleoGranel: r.possui_oleo_granel,
    possuiRestaurante: r.possui_restaurante,
    possuiTrocaOleo: r.possui_troca_oleo,
    pistaCaminhao: r.pista_caminhao,
    conveniencia: r.conveniencia,
    convenienciaAmPm: r.conveniencia_am_pm,
  }));
  // Fase 05/08/2026 (achado real do Daniel: "Cobertura x Demanda" sempre
  // mostrava "ainda não há abastecimentos reais suficientes", mesmo com
  // dado real no banco -- abastecimentos_postos_visitados() não tinha
  // p_empresa_id, dependia só de RLS pra escopar) -- loga se a RPC falhar,
  // em vez de virar silenciosamente [].
  if (postosVisitadosErro) {
    console.error("[inteligencia-rede] falha ao buscar postos visitados (ignorado, mostra 0):", postosVisitadosErro);
  }
  const postosVisitados = (postosVisitadosRaw ?? []).map((r) => ({
    cnpj: r.cnpj,
    razaoSocial: r.razao_social,
    municipio: r.municipio,
    uf: r.uf,
    lat: r.lat,
    lon: r.lon,
    visitas: r.visitas,
    precoMedio: r.preco_medio,
    litrosTotal: r.litros_total,
  }));
  const dieselAnpPorUfObj = Object.fromEntries(dieselPorUf.entries());

  // Cobertura x Demanda: demanda medida só por abastecimentos reais
  // (postosVisitados, já buscado acima) — de propósito NÃO soma rotas
  // planejadas/sugeridas pelo otimizador, que não são GPS real.
  const demandaPorUf: Record<string, number> = {};
  for (const p of postosVisitados) {
    if (!p.uf) continue;
    demandaPorUf[p.uf] = (demandaPorUf[p.uf] ?? 0) + p.visitas;
  }

  // Meios de Pagamento — pedido do Daniel: "painel de preços médios com os
  // preços praticados nos abastecimentos nos diversos meios de pagamento".
  const precosPorMeioPagamento = (precosPorMeioPagamentoRaw ?? []).map((r) => ({
    provedor: r.provedor,
    uf: r.uf,
    regiao: r.regiao,
    combustivel: r.combustivel,
    precoMedio: r.preco_medio,
    litrosTotal: r.litros_total,
    valorTotal: r.valor_total,
    qtd: r.qtd_abastecimentos,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Inteligência de Rede</h1>
        <p className="mt-1 text-sm text-slate-500">
          {ehAdmin ? (
            <>
              Visão consolidada de todos os clientes — restrita ao time interno. Cobertura da rede
              de postos revendedores e comparação de preço médio contra referência nacional.
            </>
          ) : (
            <>
              Cobertura da rede de postos revendedores {nomeEmpresaSelecionada ? `de ${nomeEmpresaSelecionada}` : "da sua empresa"} e
              comparação de preço médio contra referência nacional (ANP).
            </>
          )}
        </p>
      </div>

      {!ehAdmin && empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Trocar
          </button>
        </form>
      )}

      <div className="mb-6 card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          📊 Visão Geral da Rede <AjudaIcon chave="inteligencia_rede.visao_geral" />
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Indicador label="⛽ Postos GF" valor={formatarInt(totalGf)} sub={`${estadosComPosto.size} estados`} />
          <Indicador
            label="🏙️ Municípios"
            valor={formatarInt(municipiosUnicos)}
            sub={`${coberturaBr}% dos estados`}
          />
          <Indicador
            label="🚛 Diesel Médio GF"
            valor={dieselGf > 0 ? formatarMoeda3(dieselGf) : "—"}
            sub={
              dieselGf > 0 && deltaDieselPct != null
                ? `${deltaDieselPct > 0 ? "+" : ""}${deltaDieselPct.toFixed(1)}% vs ANP`
                : "Sem dados de preço"
            }
          />
          <Indicador
            label="💰 Saving Potencial/Ano"
            valor={`R$ ${(savingPotencialAno / 1e6).toFixed(1)}M`.replace(".", ",")}
            sub="base: 100 L/sem × postos GF"
          />
        </div>
      </div>

      <AbasPainel
        abas={[
          {
            id: "precos",
            label: "⛽ Preços vs ANP",
            conteudo: (
              <>
                <div className="mb-6 card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Preço médio da rede vs referência ANP</h2>
                    {ehAdmin && (
                      <Link href="/inteligencia-rede/importar-precos-anp" className="btn-secondary">
                        Atualizar preços oficiais ANP
                      </Link>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-slate-400">
                    {semanaMaisRecente
                      ? `Referência oficial ANP da semana de ${formatDate(semanaMaisRecente.data_inicial)} a ${formatDate(semanaMaisRecente.data_final)}. Combustíveis sem categoria oficial mapeada usam uma estimativa fixa.`
                      : "Nenhuma planilha oficial da ANP foi importada ainda — usando estimativa fixa como referência provisória."}
                  </p>
                  {precoPorCombustivel.length > 0 ? (
                    <>
                      <div className="mb-5">
                        <GraficoCustoAnp dados={precoPorCombustivel} />
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-slate-500">
                          <tr>
                            <th className="py-2">Combustível</th>
                            <th className="py-2">Preço médio da rede</th>
                            <th className="py-2">Referência</th>
                            <th className="py-2">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {precoPorCombustivel.map((p) => (
                            <tr key={p.combustivel}>
                              <td className="py-2 text-slate-700">{p.combustivel}</td>
                              <td className="py-2 text-slate-700">{formatarMoeda(p.precoMedio)}</td>
                              <td className="py-2 text-slate-600">
                                {p.referencia ? (
                                  <>
                                    {formatarMoeda(p.referencia)}{" "}
                                    {p.ehOficial ? (
                                      <span className="text-xs text-status-ativo">(oficial ANP)</span>
                                    ) : (
                                      <span className="text-xs text-slate-400">(estimativa)</span>
                                    )}
                                  </>
                                ) : (
                                  "sem referência"
                                )}
                              </td>
                              <td className="py-2">
                                {p.deltaPct != null ? (
                                  <span className={p.deltaPct < 0 ? "badge-ativo" : "badge-atencao"}>
                                    {p.deltaPct > 0 ? "+" : ""}
                                    {p.deltaPct.toFixed(1)}%
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Ainda não há preços cadastrados. Importe as planilhas em Postos Revendedores.
                    </p>
                  )}
                </div>

                <div className="card p-4">
                  <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  💰 Saving Mensal Acumulado <AjudaIcon chave="inteligencia_rede.saving_acumulado" />
                </h2>
                  <p className="mb-3 text-xs text-slate-400">
                    Evolução mensal do preço médio GF. Barras verdes = abaixo do ANP (saving); vermelhas
                    = acima do ANP (custo extra).
                  </p>
                  <GraficoSavingMensal dados={evolucaoMensal} referencias={referenciasPorCombustivel} />
                </div>
              </>
            ),
          },
          {
            id: "alertas",
            label: "⚠️ Alertas de Preço",
            conteudo: (
              <div className="card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Postos com preço acima do ANP</h2>
                <p className="mb-4 text-xs text-slate-400">
                  Postos GF com preço mais de 5% acima da referência ANP (município → estado → Brasil).
                </p>

                <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Indicador label="⚠️ Postos em Alerta" valor={formatarInt(totalAlertas)} sub={`${pctAlerta.toFixed(0)}% da base`} />
                  <Indicador label="✅ Dentro da Média" valor={formatarInt(totalAvaliados - totalAlertas)} />
                  <Indicador label="📈 Pior Desvio" valor={`+${piorDesvio.toFixed(1)}%`} />
                  <Indicador label="📊 Desvio Médio" valor={`+${desvioMedio.toFixed(1)}%`} />
                </div>

                {alertasPorEstado.length > 0 ? (
                  <div className="mb-6 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                        Postos em Alerta por Estado
                      </h3>
                      <GraficoAlertasPorEstado dados={alertasPorEstado} />
                    </div>
                    <div className="overflow-x-auto">
                      <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Resumo por Estado</h3>
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-slate-500">
                          <tr>
                            <th className="py-2">Estado</th>
                            <th className="py-2">Postos</th>
                            <th className="py-2">Pior Desvio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {alertasPorEstado.map((e) => (
                            <tr key={e.uf}>
                              <td className="py-2 text-slate-700">{e.uf}</td>
                              <td className="py-2 text-slate-700">{e.postosAlerta}</td>
                              <td className="py-2 text-red-600">+{e.piorDesvio.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Nenhum posto em alerta no momento.</p>
                )}

                {top20Alertas.length > 0 && (
                  <div className="overflow-x-auto">
                    <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                      Top 20 Postos com Maior Desvio
                    </h3>
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="py-2 pr-3">Posto</th>
                          <th className="py-2 pr-3">Município</th>
                          <th className="py-2 pr-3">UF</th>
                          <th className="py-2 pr-3">Combustível</th>
                          <th className="py-2 pr-3">Preço GF</th>
                          <th className="py-2 pr-3">Ref. ANP</th>
                          <th className="py-2 pr-3">Base</th>
                          <th className="py-2">Desvio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {top20Alertas.map((a, i) => (
                          <tr key={`${a.cnpj}__${a.combustivel}__${i}`}>
                            <td className="py-2 pr-3 text-slate-700">{a.razao_social ?? "—"}</td>
                            <td className="py-2 pr-3 text-slate-600">{a.municipio ?? "—"}</td>
                            <td className="py-2 pr-3 text-slate-600">{a.uf ?? "—"}</td>
                            <td className="py-2 pr-3 text-slate-600">{a.combustivel}</td>
                            <td className="py-2 pr-3 tabular-nums text-slate-700">{formatarMoeda3(a.preco_gf)}</td>
                            <td className="py-2 pr-3 tabular-nums text-slate-600">{formatarMoeda3(a.preco_anp)}</td>
                            <td className="py-2 pr-3 text-xs text-slate-400">{a.nivel_anp}</td>
                            <td className="py-2 font-medium text-red-600">
                              +{a.diff_pct.toFixed(1)}% (+{formatarMoeda3(a.diff_rs)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "comparativo",
            label: "⚖️ Modo Comparativo",
            conteudo: (
              <div className="card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Comparar dois estados ou regiões</h2>
                <p className="mb-4 text-xs text-slate-400">
                  Postos, cobertura, distribuidoras e preço médio por combustível, lado a lado.
                </p>
                <ModoComparativo
                  postosPorUf={postosPorUfObj}
                  municipiosPorUf={municipiosPorUfObj}
                  coordPorUf={coordPorUf}
                  distribuidorasPorUf={distribuidorasPorUf}
                  precosPorUf={precosPorUf}
                  ufsDisponiveis={Array.from(postosPorUf.keys()).sort()}
                />
              </div>
            ),
          },
          {
            id: "executivo",
            label: "👔 Macrorregião & Expansão",
            conteudo: (
              <>
                <div className="mb-6 card p-4">
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">
                    🗺️ Cobertura da Rede por Macrorregião
                  </h2>
                  <p className="mb-3 text-xs text-slate-400">
                    % dos municípios de cada macrorregião que já têm ao menos 1 posto GF (total de
                    municípios por região: referência IBGE).
                  </p>
                  <GraficoCoberturaMacrorregiao dados={coberturaMacrorregiao} />
                </div>

                <div className="card p-4">
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">🎯 Top Oportunidades de Expansão</h2>
                  <p className="mb-3 text-xs text-slate-400">
                    Ranqueamento dos estados com maior potencial: menor penetração GF e maior preço
                    de mercado (diesel ANP) = maior oportunidade.
                  </p>
                  <GraficoOportunidadesExpansao dados={oportunidades} />
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="py-2 pr-3">UF</th>
                          <th className="py-2 pr-3">Postos GF</th>
                          <th className="py-2 pr-3">Penetração</th>
                          <th className="py-2 pr-3">Diesel ANP</th>
                          <th className="py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {oportunidades.map((o) => (
                          <tr key={o.uf}>
                            <td className="py-2 pr-3 text-slate-700">{o.uf}</td>
                            <td className="py-2 pr-3 text-slate-600">{o.postosGf}</td>
                            <td className="py-2 pr-3 text-slate-600">{o.penetracaoPct.toFixed(2)}%</td>
                            <td className="py-2 pr-3 text-slate-600">
                              {o.dieselAnp != null ? formatarMoeda(o.dieselAnp) : "—"}
                            </td>
                            <td className="py-2 font-medium text-slate-900">{o.score.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ),
          },
          {
            id: "cobertura-demanda",
            label: "🎯 Cobertura × Demanda",
            conteudo: (
              <div className="card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  Cobertura × Demanda — Expansão Estratégica da Rede
                </h2>
                <p className="mb-4 text-xs text-slate-400">
                  Cruza demanda real da frota (abastecimentos) com ausência de postos GF por UF.
                </p>
                <CoberturaDemanda postosPorUf={postosPorUfObj} demandaPorUf={demandaPorUf} />
              </div>
            ),
          },
          {
            id: "cruzamentos",
            label: "🔀 Cruzamentos Avançados",
            conteudo: (
              <div className="card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  Cruzamentos Avançados — Preço × Localização × Concorrência
                </h2>
                <p className="mb-4 text-xs text-slate-400">
                  Regiões caras vs baratas, clusters de oportunidade por município, GF vs ANP por UF e onde a
                  frota realmente abastece.
                </p>
                <CruzamentosAvancados
                  precosPorUf={precosPorUf}
                  historico={historicoDetalhado}
                  desvios={desvioAnp}
                  postosVisitados={postosVisitados}
                  dieselAnpPorUf={dieselAnpPorUfObj}
                />
              </div>
            ),
          },
          {
            id: "operacional",
            label: "🚦 Operacional",
            conteudo: (
              <div className="card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Dashboard Operacional</h2>
                <p className="mb-4 text-xs text-slate-400">
                  Mapa de preços, postos com preço inconsistente vs ANP, score composto por região e
                  distribuição de graus A/B/C/D.
                </p>
                <Operacional precosMapa={precosMapaOperacional} desvios={desvioAnp} servicos={servicosPosto} />
              </div>
            ),
          },
          {
            id: "meios-pagamento",
            label: "💳 Meios de Pagamento",
            conteudo: (
              <PrecosPorMeioPagamento dados={precosPorMeioPagamento} />
            ),
          },
          {
            id: "evolucao",
            label: "📈 Evolução Temporal",
            conteudo: (
              <div className="card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  Evolução Temporal de Preços
                </h2>
                <p className="mb-4 text-xs text-slate-400">
                  Tendência por região, volatilidade e ranking de estabilidade dos postos.
                </p>
                <EvolucaoTemporal registros={historicoDetalhado} precoReal={precoRealPeriodo} />
              </div>
            ),
          },
          {
            id: "tendencia",
            label: "📅 Tendência & Sazonalidade",
            conteudo: (
              <div className="card p-4">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  Tendência de preço e sazonalidade por estado
                </h2>
                <p className="mb-4 text-xs text-slate-400">
                  Regressão linear por estado, calendário de sazonalidade (mês do ano) e
                  volatilidade mensal por combustível.
                </p>
                <TendenciaSazonalidade serie={serieTendencia} volatilidade={volatilidadeMensal} />
              </div>
            ),
          },
          {
            id: "mapa",
            label: "🗺️ Mapa & Municípios",
            conteudo: (
              <>
                <div className="mb-6 card p-4">
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">🗺️ Mapa de Densidade</h2>
                  <p className="mb-3 text-xs text-slate-400">Distribuição geográfica dos postos GF.</p>
                  <MapaDensidadeLazy pontos={pontosMapa} />
                </div>

                <div className="mb-6 card p-4">
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">Top 10 Municípios com Mais Postos GF</h2>
                  <GraficoTopMunicipios dados={topMunicipios} />
                </div>

                <div className="card p-4">
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">Cobertura por estado (vs referência ANP)</h2>
                  {cobertura.length > 0 ? (
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr>
                          <th className="py-2">UF</th>
                          <th className="py-2">Postos na rede</th>
                          <th className="py-2">Total ANP (referência)</th>
                          <th className="py-2">Penetração</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cobertura.map((c) => (
                          <tr key={c.uf}>
                            <td className="py-2 text-slate-700">{c.uf}</td>
                            <td className="py-2 text-slate-700">{c.postosGf}</td>
                            <td className="py-2 text-slate-600">{c.totalAnp || "—"}</td>
                            <td className="py-2 text-slate-600">{c.totalAnp ? `${c.penetracao.toFixed(2)}%` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Ainda não há postos cadastrados. Importe a planilha em Postos Revendedores.
                    </p>
                  )}
                </div>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

function Indicador({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
