import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { comQueryLogging } from "@/lib/supabase/instrumentacao";

// Cliente Supabase para uso em Server Components / Server Actions / Route Handlers.
// Propaga os cookies de sessão do usuário para que o RLS saiba "quem" está pedindo os dados.
export async function createClient() {
  const cookieStore = await cookies();

  return comQueryLogging(createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado a partir de um Server Component — ok ignorar,
            // o middleware cuida de renovar a sessão.
          }
        },
      },
    }
  ));
}
