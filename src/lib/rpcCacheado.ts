import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Funcoes = Database["public"]["Functions"];

// Cache de curta duração (padrão 3 min) pras RPCs pesadas do Dashboard.
// Motivo: cada abertura do Dashboard disparava ~25 consultas; com o banco
// pequeno, vários cliques/F5 em sequência saturavam tudo (ver incidente de
// 27/11/2026, consultas de 24-50 s). A chave inclui o USUÁRIO (as RPCs
// respeitam RLS — um usuário nunca pode ler o cache de outro) e os
// argumentos. Só resultados de SUCESSO ficam em cache: erro é lançado pra
// dentro do unstable_cache (não cacheia) e devolvido como { data: null, error }.
export async function rpcCacheado<N extends keyof Funcoes>(
  supabase: SupabaseClient<Database>,
  usuarioId: string,
  nome: N,
  args: Funcoes[N]["Args"],
  segundos = 180
): Promise<{ data: Funcoes[N]["Returns"] | null; error: { message: string } | null }> {
  try {
    const resultado = await unstable_cache(
      async () => {
        const cliente = supabase as unknown as {
          rpc: (n: string, a: unknown) => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
        const { data, error } = await cliente.rpc(String(nome), args);
        if (error) throw new Error(error.message ?? "Erro na consulta");
        return { data: (data ?? null) as Funcoes[N]["Returns"] | null };
      },
      ["rpc-cacheado", String(nome), usuarioId, JSON.stringify(args ?? {})],
      { revalidate: segundos }
    )();
    return { data: resultado.data, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "Erro na consulta" } };
  }
}
