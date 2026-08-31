// Sentry — runtime Edge (middleware.ts, se algum dia existir). Ver
// sentry.client.config.ts pra contexto da Fase Comercial.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
