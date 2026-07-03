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
  fonte: "gf" | "anp_municipio" | "anp_estado" | "anp_brasil";
  combustivelGf?: string;
};

type LinhaAnp = { produto: string; preco_medio: number | null; data_final: string };

function maisRecentePorProduto(linhas: LinhaAnp[]) {
  const mapa = new Map<string, LinhaAnp>();
  for (const l of linhas) if (!mapa.has(l.produto)) mapa.set(l.produto, l);
  return mapa;
}

// Resolve o preço "vigente" por categoria de combustível para um posto: o
// preço próprio dele (vindo de preco_posto.xlsx, tabela historico_precos)
// SEMPRE prevalece quando existe. Só cai para a estimativa oficial da ANP
// (precos_anp.xlsx) — nesta ordem: município do posto, depois estado, por
// fim Brasil — quando o posto não tem preço próprio para aquela categoria.
export async function resolverPrecosVigentes(
  supabase: Supabase,
  posto: { municipio: string | null; uf: string | null },
  precosGf: { combustivel: string; preco: number; data_ref: string }[]
): Promise<PrecoResolvido[]> {
  const resultado: PrecoResolvido[] = [];
  const categoriaCobertaPorGf = new Set<string>();

  for (const p of precosGf) {
    const categoria = PRODUTO_PARA_CATEGORIA_ANP[p.combustivel];
    resultado.push({
      categoria: categoria ?? p.combustivel,
      preco: p.preco,
      dataRef: p.data_ref,
      fonte: "gf",
      combustivelGf: p.combustivel,
    });
    if (categoria) categoriaCobertaPorGf.add(categoria);
  }

  let faltando: string[] = CATEGORIAS_ANP.filter((c) => !categoriaCobertaPorGf.has(c));
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
