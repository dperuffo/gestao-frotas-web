"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// Fase Dark-Mode (11/09/2026, pedido do Daniel: suporte a modo escuro com
// detecção automática do SO como padrão + toggle manual que sobrepõe e
// persiste) — next-themes cuida das 3 partes sem reinventar a roda:
// - `attribute="class"` alterna a classe `.dark` no <html>, que é o que o
//   `darkMode: "class"` do tailwind.config.ts espera.
// - `defaultTheme="system"` + `enableSystem`: sem escolha manual do
//   usuário, segue `prefers-color-scheme` do SO/navegador.
// - Escolha manual (via ThemeToggle.tsx) persiste sozinha em
//   `localStorage` (chave "theme") e passa a ter prioridade sobre o SO.
// next-themes também injeta um script inline síncrono no <head> (antes do
// React hidratar) que já aplica a classe certa — evita o "flash" de tema
// errado (FOUC) que uma implementação manual em useEffect teria.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
