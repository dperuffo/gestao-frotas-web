import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { comQueryLogging } from "@/lib/supabase/instrumentacao";

// Cliente Supabase com a chave de SERVICE ROLE — ignora RLS por completo.
// Usar SOMENTE em código de servidor (Server Actions / Route Handlers),
// NUNCA importar isto em um Client Component. É o que permite, por exemplo,
// convidar um novo usuário (criar o login dele no Supabase Auth).
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada em .env.local — necessária para convidar usuários."
    );
  }

  return comQueryLogging(
    createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  );
}
