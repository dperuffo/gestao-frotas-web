"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";

// Fase UX-Navegacao (27/08/2026, pedido do Daniel: "ajustes da experiência
// do usuário e navegação") — auditoria mobile encontrou o menu lateral como
// o maior bloqueio de uso do painel no celular: <aside> fixo de 256px,
// SEMPRE visível, sem nenhuma alternância por tamanho de tela. Numa tela de
// 375px isso deixava ~119px pro conteúdo (descontando o padding do
// <main>) — praticamente inutilizável.
//
// Este componente transforma o menu numa "gaveta" (drawer) que só aparece
// por cima da tela ao tocar no botão hambúrguer, em telas menores que `lg`
// (1024px). Em telas `lg`+ o comportamento continua idêntico ao de antes:
// menu fixo, sempre visível, sem hambúrguer nenhum (classes `lg:` abaixo
// cancelam o modo gaveta).
//
// Fecha sozinho ao navegar (troca de rota via usePathname), sem precisar
// adivinhar quais cliques dentro do menu são "navegação" vs. outra coisa
// (ex.: clicar no campo da Busca Global não deve fechar a gaveta).
export function PainelMobile({ menu, children }: { menu: ReactNode; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  return (
    <>
      <div className="glass-nav sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="glass-nav-texto flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 p-2"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="glass-nav-texto text-sm font-semibold">Fleet Network Intelligence</span>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          onClick={() => setAberto(false)}
          aria-hidden
        />
      )}

      <aside
        className={`glass-nav fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] shrink-0 flex-col overflow-y-auto transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
          className="glass-nav-texto absolute right-3 top-3 z-10 rounded-lg border border-slate-200 bg-slate-100 p-1.5 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
        {menu}
      </aside>

      {children}
    </>
  );
}
