import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Fase Design-System-Corporate-Blue (26/08/2026) — design.md pede Inter em
// tudo (display/body/labels) e JetBrains Mono só pra valores técnicos. Antes
// o app não definia nenhuma fonte própria (caía na sans-serif padrão do
// navegador) — `next/font` carrega e aplica via CSS variable, cascateando
// pra toda a aplicação através do `fontFamily.sans` do tailwind.config.ts.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Gestão de Frotas",
  description: "Plataforma de Gestão de Frotas — cadastros, dashboards e relatórios gerenciais.",
};

// Hotjar — mapa de calor e gravação de sessão (heatmaps/session replay).
// Troca do MouseFlow (Fase FLT-3): a verificação de instalação do MouseFlow
// nunca destravou (script confirmado rodando via mouseflow.isRecording() ===
// true, mas a conta nunca saiu do estado "aguardando instalação" mesmo após
// abrir chamado com o suporte deles) — Hotjar tem fluxo mais simples,
// sem esse passo extra de ativação manual. Só carrega se a env var estiver
// preenchida (Site ID em Hotjar > Settings > Sites & Organizations) e nunca
// em desenvolvimento local, pra não sujar as estatísticas com testes.
// strategy="beforeInteractive" garante que o script já vai embutido no HTML
// que o servidor manda (aprendido com o problema do MouseFlow) — só pode
// ser usada no layout raiz, que é exatamente onde este script está.
const HOTJAR_SITE_ID = process.env.NEXT_PUBLIC_HOTJAR_SITE_ID;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        {process.env.NODE_ENV === "production" && HOTJAR_SITE_ID && (
          <Script
            id="hotjar"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function (h, o, t, j, a, r) {
                  h.hj = h.hj || function () { (h.hj.q = h.hj.q || []).push(arguments); };
                  h._hjSettings = { hjid: ${HOTJAR_SITE_ID}, hjsv: 6 };
                  a = o.getElementsByTagName("head")[0];
                  r = o.createElement("script"); r.async = 1;
                  r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
                  a.appendChild(r);
                })(window, document, "https://static.hotjar.com/c/hotjar-", ".js?sv=");
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
