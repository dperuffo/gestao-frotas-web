import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CABECALHO_REQUEST_ID } from "@/lib/request-id";

// Mantém a sessão do usuário sempre renovada a cada requisição, e garante que
// só quem tem sessão válida chegue às rotas do dashboard. A exigência de MFA
// (subir de aal1 para aal2) é verificada no layout do dashboard, não aqui,
// para evitar chamadas extras à API em toda requisição (inclusive assets).
export async function updateSession(request: NextRequest) {
  // Fase enforcement-permissoes (04/08/2026) — propaga a rota atual (e a
  // query string) pro layout do dashboard via header de REQUEST (não de
  // response: `headers()` num Server Component lê os headers da requisição
  // que o middleware repassa adiante via `NextResponse.next({ request })`,
  // não os headers que voltam pro navegador — setar só em `response.headers`
  // não teria efeito nenhum aqui, achado ao revisar esta implementação antes
  // de validar). x-search só é usado hoje pro layout detectar
  // "?acesso=negado" e mostrar um aviso depois do redirect de bloqueio, sem
  // precisar tocar em cada page.tsx que já tem searchParams próprios.
  // Fase Observabilidade-Fundacao (14/08/2026, pedido do Daniel: "todo
  // endpoint da aplicação deve ter request ID único para rastreabilidade")
  // — gerado sempre aqui, nunca aceito de header vindo do cliente (evita
  // spoofing e garante que cada requisição tem um ID que só o servidor
  // criou). Vai tanto pro header de REQUEST (mesmo mecanismo já usado pra
  // x-pathname/x-search, lido via `headers()` em Server Component/Action —
  // ver src/lib/logger.ts) quanto pro header de RESPONSE, em todo ponto de
  // saída desta função, pra aparecer na aba Network do navegador e servir
  // de referência quando o Daniel/usuário reportar um problema.
  const requestId = crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-search", request.nextUrl.search);
  requestHeaders.set(CABECALHO_REQUEST_ID, requestId);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CABECALHO_REQUEST_ID, requestId);

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
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set(CABECALHO_REQUEST_ID, requestId);
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
    // Fase Índice-Público-de-Preço — página de marketing/institucional
    // (item de alta prioridade do benchmark TicketLog), dados agregados e
    // anônimos, sem necessidade de login.
    "/indice-precos",
  ]);
  const isRotaPublica =
    path.startsWith("/login") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/auth/confirm") ||
    path.startsWith("/cadastro") ||
    path.startsWith("/esqueci-senha") ||
    path.startsWith("/redefinir-senha") ||
    // Fase Rastreio-Publico (27/08/2026) — link de acompanhamento de frete
    // sem login, protegido por token de alta entropia com expiração (ver
    // rastreio_publico_frete()), não pelo cookie de sessão.
    path.startsWith("/rastreio/") ||
    rotasLandingPublicas.has(path);

  // Rotas /api/* fazem a própria autenticação (Bearer token de sessão do
  // Supabase em /api/assistente e /api/usuarios/convidar — usados pelo app
  // Flutter, que não compartilha cookie de domínio com o site; ou
  // CRON_SECRET em /api/cron/*) — nenhuma delas depende de cookie de sessão.
  // Sem esta exceção, este middleware redirecionava qualquer chamada sem
  // cookie para /login (resposta HTML, sem CORS), quebrando o Assistente
  // FNI no Flutter (cliente e posto — acharam o mesmo erro porque chamam a
  // mesma rota) e, muito provavelmente, o cron do PróFrotas também.
  const isRotaApi = path.startsWith("/api/");

  if (!user && !isRotaPublica && !isRotaApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set(CABECALHO_REQUEST_ID, requestId);
    return redirectResponse;
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
      // Fase Perf-19-07 (achado do Daniel: "lentidão excessiva em muitos
      // pontos") — este middleware roda em TODA navegação autenticada.
      // `perfil_usuario_atual` e `empresas_do_usuario` não dependem um do
      // outro (o 2º só precisa do e-mail, não do resultado do 1º), mas
      // rodavam em sequência — 2 round-trips ao Supabase em série antes
      // mesmo da página começar a carregar. Agora rodam em paralelo; o
      // pequeno custo de sempre buscar `empresaIds` mesmo pro raro caso de
      // time interno é insignificante perto do ganho pra todo mundo mais.
      const [{ data: perfil }, { data: empresaIds }] = await Promise.all([
        supabase.rpc("perfil_usuario_atual"),
        supabase.rpc("empresas_do_usuario", { p_email: user.email ?? "" }),
      ]);
      const ehTimeInterno = perfil === "admin" || user.email === "d.peruffo@gmail.com";

      if (!ehTimeInterno) {
        if (empresaIds && empresaIds.length > 0) {
          const { data: empresas } = await supabase.from("empresas").select("status").in("id", empresaIds);
          const todasSuspensas = (empresas?.length ?? 0) > 0 && empresas!.every((e) => e.status === "suspenso");

          if (todasSuspensas) {
            const url = request.nextUrl.clone();
            url.pathname = "/assinatura";
            url.searchParams.set("bloqueado", "1");
            const redirectResponse = NextResponse.redirect(url);
            redirectResponse.headers.set(CABECALHO_REQUEST_ID, requestId);
            return redirectResponse;
          }
        }
      }
    }
  }

  return response;
}
