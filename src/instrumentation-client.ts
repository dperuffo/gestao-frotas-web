// Sentry — lado do navegador (erros de UI, cliques que quebram, etc.).
// Fase Comercial (31/08/2026, pedido do Daniel na auditoria de prontidão
// comercial) — antes disso, o único canal de erro era o alertar()
// (src/lib/alertas.ts), que só dispara em pontos escolhidos a dedo (health
// check, alguns erros de servidor) e não captura automaticamente exceções
// não tratadas no navegador do cliente. O Sentry cobre essa lacuna: captura
// TODO erro não tratado (stack trace, breadcrumbs, o que o usuário clicou
// antes de quebrar) sem precisar instrumentar cada tela manualmente.
//
// `instrumentation-client.ts` (não `sentry.client.config.ts`) é a convenção
// atual — o Next.js 15 já reconhece esse nome nativamente, e é o único
// caminho que segue funcionando quando o build usa Turbopack (o formato
// antigo foi avisado como depreciado pelo próprio SDK no primeiro build
// depois da instalação).
//
// NEXT_PUBLIC_SENTRY_DSN vem de env pra não deixar hardcoded — sem a
// variável configurada, o SDK simplesmente não inicializa (fica em no-op),
// então é seguro fazer deploy mesmo antes de configurar a conta no Sentry.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Amostragem de performance (traces) — 10% é um ponto de partida razoável
  // pra não estourar o plano gratuito do Sentry com volume alto; pode subir
  // depois de ver o custo real.
  tracesSampleRate: 0.1,

  // Session Replay: grava a tela (com mascaramento de texto/mídia) só nas
  // sessões que efetivamente deram erro — ajuda a reproduzir o bug sem
  // custo alto de gravar 100% do tráfego.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Silencioso em dev local (evita ruído/custo enquanto se testa na
  // própria máquina) — só reporta de verdade em produção.
  enabled: process.env.NODE_ENV === "production",
});

// Hook exigido pelo SDK pra rastrear troca de rota (navegação client-side
// do App Router) como parte do tracing de performance.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
