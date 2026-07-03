import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Mantém a sessão do usuário sempre renovada a cada requisição, e garante que
// só quem tem sessão válida chegue às rotas do dashboard. A exigência de MFA
// (subir de aal1 para aal2) é verificada no layout do dashboard, não aqui,
// para evitar chamadas extras à API em toda requisição (inclusive assets).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Fase 26 — landing pública + páginas legais (termos/privacidade/sobre,
  // pt e en) viraram rotas do próprio Next.js, servidas em
  // fxgestaodefrotasonline.com pra visitante anônimo. Comparação exata (não
  // startsWith) pra "/" não engolir sem querer nenhuma outra rota.
  const rotasLandingPublicas = new Set([
    "/",
    "/termos",
    "/termos-en",
    "/privacidade",
    "/privacidade-en",
    "/sobre",
    "/sobre-en",
  ]);
  const isRotaPublica =
    path.startsWith("/login") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/cadastro") ||
    path.startsWith("/esqueci-senha") ||
    path.startsWith("/redefinir-senha") ||
    rotasLandingPublicas.has(path);

  if (!user && !isRotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Bloqueio de assinatura/trial expirado. `status = "suspenso"` cobre os
  // dois casos que já viram esse status hoje: trial vencido sem conversão
  // (Edge Function email-trials) e falha de pagamento (stripe-webhook,
  // evento invoice.payment_failed). Time interno (perfil admin ou o e-mail
  // do Daniel) nunca é bloqueado — inclusive porque é quem pode precisar
  // entrar numa empresa suspensa pra ajudar o cliente. `/assinatura` e
  // `/chamados` continuam liberadas mesmo suspenso, senão a pessoa nunca
  // conseguiria pagar de novo ou pedir ajuda.
  if (user && !isRotaPublica) {
    const rotaLiberadaSuspenso =
      path.startsWith("/assinatura") || path.startsWith("/chamados") || path.startsWith("/mfa-setup");

    if (!rotaLiberadaSuspenso) {
      const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
      const ehTimeInterno = perfil === "admin" || user.email === "d.peruffo@gmail.com";

      if (!ehTimeInterno) {
        const { data: empresaIds } = await supabase.rpc("empresas_do_usuario", { p_email: user.email ?? "" });

        if (empresaIds && empresaIds.length > 0) {
          const { data: empresas } = await supabase.from("empresas").select("status").in("id", empresaIds);
          const todasSuspensas = (empresas?.length ?? 0) > 0 && empresas!.every((e) => e.status === "suspenso");

          if (todasSuspensas) {
            const url = request.nextUrl.clone();
            url.pathname = "/assinatura";
            url.searchParams.set("bloqueado", "1");
            return NextResponse.redirect(url);
          }
        }
      }
    }
  }

  return response;
}
