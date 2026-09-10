import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Fase Pente-Fino-Performance (10/09/2026, item 1.3) — a tabela
// anp_precos_referencia é dado de referência público (preço oficial da ANP
// por região/estado/município/produto), igual pra TODOS os tenants — não
// tem coluna de empresa_id, não passa por RLS por tenant. É lida do zero em
// toda visita a /inteligencia-rede (3 queries), mas só muda quando alguém
// importa manualmente ou quando a Edge Function do Supabase roda a
// atualização semanal — um bom candidato de baixo risco pra unstable_cache.
//
// Importante: usa `createAdminClient()` (service role, sem depender de
// cookies) em vez do client normal (`createClient()`, que lê `cookies()` do
// request) — o Next.js proíbe chamar `cookies()`/`headers()` dentro de uma
// função cacheada com `unstable_cache` (o resultado seria compartilhado
// entre requests de usuários diferentes). Como esta tabela não tem RLS por
// tenant, ler com service role aqui é seguro — não existe "dado de outro
// cliente" pra vazar nela.
//
// `revalidate: 3600` (1h) cobre o caso em que os dados mudam sem passar por
// nenhuma rota Next.js (a atualização semanal automática roda direto do
// Supabase Edge Function) — mesmo sem revalidateTag explícito, a tela nunca
// fica mais que 1h desatualizada. As duas rotas de importação manual (ver
// route.ts de /api/inteligencia-rede/importar-precos-anp e
// /api/cron/atualizar-precos-anp) chamam `revalidateTag` logo depois de
// gravar, pra refletir na hora quando o caminho usado for um desses.
export const ANP_REFERENCIA_TAG = "anp-precos-referencia";

export type AnpPorEstadoLinha = { estado: string; produto: string; preco_medio: number | null };
export type ReferenciaOficialLinha = { produto: string; preco_medio: number | null };
export type SemanaMaisRecente = { data_inicial: string; data_final: string } | null;

export const buscarReferenciaAnpCacheada = unstable_cache(
  async () => {
    const supabase = createAdminClient();

    const [{ data: anpPorEstadoRaw }, { data: semanaMaisRecente }] = await Promise.all([
      supabase.from("anp_precos_referencia").select("estado, produto, preco_medio").eq("nivel", "estado"),
      supabase
        .from("anp_precos_referencia")
        .select("data_inicial, data_final")
        .eq("nivel", "brasil")
        .order("data_final", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let referenciaSemana: ReferenciaOficialLinha[] = [];
    if (semanaMaisRecente) {
      const { data } = await supabase
        .from("anp_precos_referencia")
        .select("produto, preco_medio")
        .eq("nivel", "brasil")
        .eq("data_final", semanaMaisRecente.data_final);
      referenciaSemana = data ?? [];
    }

    return {
      anpPorEstadoRaw: (anpPorEstadoRaw ?? []) as AnpPorEstadoLinha[],
      semanaMaisRecente: semanaMaisRecente as SemanaMaisRecente,
      referenciaSemana,
    };
  },
  ["anp-precos-referencia"],
  { revalidate: 3600, tags: [ANP_REFERENCIA_TAG] }
);
