import type { createClient } from "@/lib/supabase/server";
import { PRODUTO_PARA_CATEGORIA_ANP, UF_PARA_ESTADO_ANP } from "./constants";
import { normalizarTexto } from "./utils";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// As 7 categorias padronizadas que a ANP usa no relatório oficial
// (precos_anp.xlsx) — ver PRODUTO_PARA_CATEGORIA_ANP para o de-para com os
// nomes de produto usados na planilha por posto (preco_posto.xlsx).
const CATEGORIAS_ANP = [
  "ETANOL HIDRATADO",
  "GASOLINA ADITIVADA",
  "GASOLINA COMUM",
  "GLP",
  "GNV",
  "OLEO DIESEL",
  "OLEO DIESEL S10",
] as const;

export type PrecoResolvido = {
  categoria: string;
  preco: number;
  dataRef: string;
  fonte: "meios_pagamento" | "meus_precos" | "gf" | "anp_municipio" | "anp_estado" | "anp_brasil";
  combustivelGf?: string;
};

type LinhaAnp = { produto: string; preco_medio: number | null; data_final: string };

function maisRecentePorProduto(linhas: LinhaAnp[]) {
  const mapa = new Map<string, LinhaAnp>();
  for (const l of linhas) if (!mapa.has(l.produto)) mapa.set(l.produto, l);
  return mapa;
}

// Fase 27.138 — pedido do Daniel: "ajustar a ordem de apresentação dos
// preços de combustíveis nos cards de consultas: 1) Preços de combustíveis
// praticados nos meios de pagamentos, 2) Preços de combustíveis cadastrados
// pelos usuarios na tela do posto, preços de combustíveis ANP, sendo
// primeiro por município e depois por estado". Cascata agora tem 5 níveis
// (do mais confiável/recente pro mais genérico):
//   1) meios_pagamento — última transação real (qualquer provedor) naquele
//      posto, via RPC preco_meios_pagamento_por_posto (últimos 60 dias).
//   2) meus_precos — preço que o próprio posto publicou em "Meus Preços"
//      (tabela precos_postos, Fase 27.57) — só existe/é visível quando o
//      posto já tem alguma negociação com o cliente logado (RLS da Fase
//      27.57, não alterada aqui).
//   3) gf — preço "próprio do posto" importado em lote (preco_posto.xlsx,
//      tabela historico_precos) — comportamento ORIGINAL desta função,
//      preservado sem nenhuma mudança, só reordenado pra 3º lugar.
//   4/5) anp_municipio → anp_estado → anp_brasil — estimativa oficial da
//      ANP, inalterada.
// Cada nível só entra pra cobrir as categorias que os níveis anteriores
// ainda não resolveram — nunca sobrescreve um preço já resolvido por um
// nível de maior prioridade.
export async function resolverPrecosVigentes(
  supabase: Supabase,
  posto: { cnpj: string | null; empresaPostoId?: string | null; municipio: string | null; uf: string | null },
  precosGf: { combustivel: string; preco: number; data_ref: string }[]
): Promise<PrecoResolvido[]> {
  const resultado: PrecoResolvido[] = [];
  const categoriaResolvida = new Set<string>();

  // Nível 1 — meios de pagamento (RPC SECURITY DEFINER: enxerga além da RLS
  // do cliente logado só pra devolver produto/preço/data agregados, nunca
  // dado de outro cliente).
  if (posto.cnpj) {
    const { data: precosMeiosPagamento } = await supabase.rpc("preco_meios_pagamento_por_posto", {
      p_posto_cnpj: posto.cnpj,
    });
    for (const p of precosMeiosPagamento ?? []) {
      const categoria = PRODUTO_PARA_CATEGORIA_ANP[p.produto] ?? p.produto;
      if (categoriaResolvida.has(categoria)) continue;
      resultado.push({
        categoria,
        preco: p.preco_litro,
        dataRef: p.data_abastecimento,
        fonte: "meios_pagamento",
        combustivelGf: p.produto,
      });
      categoriaResolvida.add(categoria);
    }
  }

  // Nível 2 — preço que o próprio posto cadastrou em "Meus Preços"
  // (precos_postos, Fase 27.57). RLS dessa tabela já limita a leitura a
  // quem tem negociação com o posto — não mexida aqui.
  if (posto.empresaPostoId) {
    const { data: meusPrecos } = await supabase
      .from("precos_postos")
      .select("combustivel, preco, atualizado_em")
      .eq("empresa_posto_id", posto.empresaPostoId);
    for (const p of meusPrecos ?? []) {
      const categoria = PRODUTO_PARA_CATEGORIA_ANP[p.combustivel] ?? p.combustivel;
      if (categoriaResolvida.has(categoria)) continue;
      resultado.push({
        categoria,
        preco: p.preco,
        dataRef: p.atualizado_em,
        fonte: "meus_precos",
        combustivelGf: p.combustivel,
      });
      categoriaResolvida.add(categoria);
    }
  }

  // Nível 3 — preço "próprio do posto" importado em lote (comportamento
  // original desta função, inalterado — só reordenado pra 3º lugar).
  for (const p of precosGf) {
    const categoria = PRODUTO_PARA_CATEGORIA_ANP[p.combustivel];
    if (categoria && categoriaResolvida.has(categoria)) continue;
    resultado.push({
      categoria: categoria ?? p.combustivel,
      preco: p.preco,
      dataRef: p.data_ref,
      fonte: "gf",
      combustivelGf: p.combustivel,
    });
    if (categoria) categoriaResolvida.add(categoria);
  }

  let faltando: string[] = CATEGORIAS_ANP.filter((c) => !categoriaResolvida.has(c));
  if (faltando.length === 0) return resultado;

  const municipioNorm = posto.municipio ? normalizarTexto(posto.municipio) : "";
  const estadoAnp = posto.uf ? UF_PARA_ESTADO_ANP[posto.uf.toUpperCase()] : undefined;

  if (municipioNorm && estadoAnp && faltando.length > 0) {
    const { data } = await supabase
      .from("anp_precos_referencia")
      .select("produto, preco_medio, data_final")
      .eq("nivel", "municipio")
      .eq("municipio", municipioNorm)
      .eq("estado", estadoAnp)
      .in("produto", faltando)
      .order("data_final", { ascending: false });
    const mapa = maisRecentePorProduto(data ?? []);
    faltando = faltando.filter((categoria) => {
      const achado = mapa.get(categoria);
      if (!achado || achado.preco_medio == null) return true;
      resultado.push({ categoria, preco: achado.preco_medio, dataRef: achado.data_final, fonte: "anp_municipio" });
      return false;
    });
  }

  if (estadoAnp && faltando.length > 0) {
    const { data } = await supabase
      .from("anp_precos_referencia")
      .select("produto, preco_medio, data_final")
      .eq("nivel", "estado")
      .eq("estado", estadoAnp)
      .in("produto", faltando)
      .order("data_final", { ascending: false });
    const mapa = maisRecentePorProduto(data ?? []);
    faltando = faltando.filter((categoria) => {
      const achado = mapa.get(categoria);
      if (!achado || achado.preco_medio == null) return true;
      resultado.push({ categoria, preco: achado.preco_medio, dataRef: achado.data_final, fonte: "anp_estado" });
      return false;
    });
  }

  if (faltando.length > 0) {
    const { data } = await supabase
      .from("anp_precos_referencia")
      .select("produto, preco_medio, data_final")
      .eq("nivel", "brasil")
      .in("produto", faltando)
      .order("data_final", { ascending: false });
    const mapa = maisRecentePorProduto(data ?? []);
    for (const categoria of faltando) {
      const achado = mapa.get(categoria);
      if (achado && achado.preco_medio != null) {
        resultado.push({ categoria, preco: achado.preco_medio, dataRef: achado.data_final, fonte: "anp_brasil" });
      }
    }
  }

  return resultado;
}
