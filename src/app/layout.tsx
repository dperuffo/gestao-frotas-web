import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestão de Frotas",
  description: "Plataforma de Gestão de Frotas — cadastros, dashboards e relatórios gerenciais.",
};

// MouseFlow — mapa de calor e gravação de sessão (heatmaps/session replay).
// Só carrega se a env var estiver preenchida (pegue o Website ID em
// mouseflow.com > Websites > seu site > Install Tracking Code) e nunca em
// desenvolvimento local, pra não sujar as estatísticas com testes.
const MOUSEFLOW_WEBSITE_ID = process.env.NEXT_PUBLIC_MOUSEFLOW_WEBSITE_ID;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        {process.env.NODE_ENV === "production" && MOUSEFLOW_WEBSITE_ID && (
          <Script
            id="mouseflow"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window._mfq = window._mfq || [];
                (function () {
                  var mf = document.createElement("script");
                  mf.type = "text/javascript";
                  mf.defer = true;
                  mf.src = "//cdn.mouseflow.com/projects/${MOUSEFLOW_WEBSITE_ID}.js";
                  document.getElementsByTagName("head")[0].appendChild(mf);
                })();
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
