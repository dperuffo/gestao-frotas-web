import type { ReactNode } from "react";
import { AuthLogoHeader } from "./AuthLogoHeader";

// Fase Paleta-Clara (04/09/2026, pedido do Daniel: "quero que estas telas
// também entrem no padrão de design.md atual com cores claras") — as 3
// telas públicas de autenticação eram a última parte do app ainda com o
// fundo off-black (bg-frota-950) que o resto do sistema já abandonou.
// Passa a usar o mesmo fundo claro (frota-50) do painel interno, mantendo
// só o "cenário" de tela cheia (em vez de cartão isolado sobre branco
// puro) como diferencial da landing/auth.
//
// A grade decorativa, que antes usava linhas brancas translúcidas sobre
// fundo escuro, agora usa linhas escuras translúcidas sobre fundo claro
// (mesmo efeito, invertido). Sem blur/glow — minimalismo suíço não usa
// esse tipo de "brilho" decorativo.
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-frota-50 px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(17,17,17,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.04) 1px, transparent 1px)",
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

// Fase Paleta-Clara — o cartão escuro "vidro fosco" vira o mesmo `.card`
// branco sólido usado no resto do app (borda slate-200, sombra suave,
// sem blur), só com mais padding (p-8) por ser o único conteúdo da tela.
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      {children}
    </div>
  );
}
