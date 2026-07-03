import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// O Google redireciona para cá depois do login, com um "code" na URL.
// Trocamos esse code por uma sessão válida do Supabase Auth (cookies de sessão).
//
// Importante: NÃO usamos o "origin" que sai direto de `new URL(request.url)`.
// Em produção (Railway), o proxy entrega a requisição pro container usando o
// host/porta interna (ex: localhost:8080) e só preserva o domínio público
// real via os headers x-forwarded-host/x-forwarded-proto — o mesmo motivo
// pelo qual origemAtual() em src/app/cadastro/actions.ts já lê esses headers
// em vez do host cru. Sem isso, o redirect pós-login ia sempre para
// "localhost:8080/dashboard" em vez do domínio real (bug encontrado após o
// deploy na Railway — ver README Fase 26.1).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

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
