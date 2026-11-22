import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { invalidarPrefixo, obterOuDefinir } from "@/lib/cache";

// Leituras por usuário que o layout e as páginas repetem a CADA abertura de tela e que quase
// nunca mudam (quem é o perfil, a quais empresas ele tem acesso). Ficam em memória por 30 s,
// sempre com o e-mail do usuário JÁ AUTENTICADO na chave — nunca compartilhadas entre pessoas.
// Cada ida ao banco custa ~130 ms (servidor em Virginia, Supabase em São Paulo).
// Quem altera vínculos/perfis chama `invalidarCacheUsuarios()` para refletir na hora; sem isso
// a mudança aparece em até 30 s (ou 60 s no acesso ao Insights de IA).
type Supabase = SupabaseClient<Database>;

const PREFIXO = "usuario:";
export const TTL_USUARIO_MS = 30_000;

export function invalidarCacheUsuarios(): void {
  invalidarPrefixo(PREFIXO);
}

export function empresasDoUsuarioCacheado(supabase: Supabase, email: string): Promise<string[]> {
  return obterOuDefinir(`${PREFIXO}empresas:${email}`, TTL_USUARIO_MS, async () => {
    const { data } = await supabase.rpc("empresas_do_usuario", { p_email: email });
    return (data ?? []) as string[];
  });
}

export function perfilAtualCacheado(supabase: Supabase, email: string): Promise<string | null> {
  return obterOuDefinir(`${PREFIXO}perfil:${email}`, TTL_USUARIO_MS, async () => {
    const { data } = await supabase.rpc("perfil_usuario_atual");
    return (data as string | null) ?? null;
  });
}

export function vinculosDiretosCacheado(supabase: Supabase, email: string): Promise<string[]> {
  return obterOuDefinir(`${PREFIXO}vinculos:${email}`, TTL_USUARIO_MS, async () => {
    const { data } = await supabase.from("usuarios_empresas").select("empresa_id").eq("user_email", email).eq("ativo", true);
    return (data ?? []).map((v) => v.empresa_id as string);
  });
}

// Lista (id, nome) das empresas visíveis, chaveada pelos ids (ou "admin" = todas).
export function listaEmpresasCacheada(
  supabase: Supabase,
  chave: string,
  buscar: () => Promise<{ id: string; nome: string }[]>
): Promise<{ id: string; nome: string }[]> {
  return obterOuDefinir(`${PREFIXO}lista-empresas:${chave}`, TTL_USUARIO_MS, buscar);
}

export function contagemEmpresasCacheada(supabase: Supabase): Promise<number> {
  return obterOuDefinir(`${PREFIXO}contagem-empresas`, TTL_USUARIO_MS, async () => {
    const { count } = await supabase.from("empresas").select("id", { count: "exact", head: true });
    return count ?? 0;
  });
}
