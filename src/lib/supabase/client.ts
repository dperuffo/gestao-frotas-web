import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// Cliente Supabase para uso em Client Components (roda no navegador).
// Usa a chave anônima — a segurança dos dados é garantida pelas políticas
// de RLS no banco (empresa_id do usuário logado), nunca pela chave em si.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
