import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// O Google redireciona para cá depois do login, com um "code" na URL.
// Trocamos esse code por uma sessão válida do Supabase Auth (cookies de sessão).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Loga o motivo real no terminal do servidor (npm run dev) para facilitar o diagnóstico.
    console.error("[auth/callback] Falha ao trocar o code por sessão:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?erro=oauth`);
}
