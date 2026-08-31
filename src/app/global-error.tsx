"use client";

// Fase Comercial (31/08/2026) — o App Router só chama este arquivo quando o
// próprio ROOT layout quebra (o erro mais grave possível: a página inteira
// fica em branco, sem nem o menu/topbar renderizando). Os erros de dentro
// do dashboard já são pegos por error.tsx locais de cada rota — este aqui é
// a última rede de segurança. Sem ele, esse tipo de crash nem aparecia no
// Sentry (o SDK não intercepta automaticamente o global-error do Next).
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 24, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Algo deu errado</h1>
            <p style={{ color: "#666", marginBottom: 16 }}>
              Já registramos o problema e vamos olhar. Tente recarregar a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "8px 16px", borderRadius: 4, background: "#171717", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Recarregar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
