import type { ReactNode } from "react";
import { AuthLogoHeader } from "./AuthLogoHeader";

// Fundo cheio de tela para as páginas públicas de autenticação, sobre o
// mesmo fundo off-black (bg-frota-950) já usado no resto do app — não é uma
// cor nova, é o mesmo padrão, só com o "cenário" completo em vez de um
// cartão branco isolado.
//
// Fase Swiss-Minimalism (27/08/2026): a grade e o glow ambiente antes
// usavam um tom de azul (rgba(59,130,246,...), frota-500) — agora que
// frota-500 é quase preto (mesma família do fundo), essa textura ficaria
// invisível. Grade recolorida em branco neutro (sem matiz); glow ambiente
// removido de propósito — minimalismo suíço não usa esse tipo de "brilho"
// decorativo (ver Elevation do design.md: "sharp shadows if any, fast
// loading, clear type hierarchy", nada de blur/glow colorido).
export function AuthShell({
  children,
  maxWidthClassName = "max-w-sm",
  variant = "full",
}: {
  children: ReactNode;
  maxWidthClassName?: string;
  variant?: "full" | "compact";
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-frota-950 px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
        aria-hidden
      />
      <div className={`relative w-full ${maxWidthClassName}`}>
        <AuthLogoHeader variant={variant} />
        {children}
      </div>
    </div>
  );
}

// Cartão escuro "vidro fosco" usado dentro do AuthShell — substitui o antigo
// `.card` branco (que é o padrão certo pro dashboard interno, mas destoava
// do visual dark da landing nessas 3 telas públicas).
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-frota-900/70 p-8 shadow-2xl shadow-frota-950/60 backdrop-blur-sm">
      {children}
    </div>
  );
}
