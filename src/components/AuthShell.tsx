import type { ReactNode } from "react";
import { AuthLogoHeader } from "./AuthLogoHeader";

// Fundo cheio de tela para as páginas públicas de autenticação — replica a
// textura de grade sutil em ciano da landing page (fxgestaodefrotasonline.com)
// sobre o mesmo fundo azul-marinho escuro (bg-frota-950) já usado no resto
// do app, então não é uma cor nova: é o mesmo padrão, só com o "cenário"
// completo em vez de um cartão branco isolado.
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
            "linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-0 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-frota-500/10 blur-3xl"
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
