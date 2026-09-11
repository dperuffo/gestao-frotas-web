"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import type { ReactNode } from "react";

// Fase Menu-Retratil (08/09/2026, pedido do Daniel: "o menu da aplicacao
// fosse retratil, o usuario escolhe recolher ou expandir") — chave de
// localStorage pra lembrar a preferência entre sessões. Device-only de
// propósito (mesmo padrão dos outros usos de localStorage no app — idioma
// da landing, dispensa do lembrete PWA — nenhum usa coluna de banco pra
// preferência puramente de UI). O estado nasce sempre `false` (mesmo valor
// renderizado no servidor) e só é sincronizado com o valor salvo dentro de
// um `useEffect` (roda só no client, depois do 1º render) — ler localStorage
// direto no useState() faria esse componente hidratar com um valor diferente
// do que o servidor mandou, disparando o warning de hydration mismatch do
// React.
const CHAVE_MENU_COLAPSADO = "fni_menu_colapsado";

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
  // Fase Menu-Retratil (08/09/2026) — colapsado só tem efeito visual em telas
  // `lg`+ (ver classes condicionais abaixo); no mobile o menu continua sendo
  // a gaveta de sempre, sempre expandida quando aberta.
  const [colapsado, setColapsado] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setColapsado(window.localStorage.getItem(CHAVE_MENU_COLAPSADO) === "1");
    } catch {
      // localStorage indisponível (modo privado etc.) — mantém expandido.
    }
  }, []);

  function alternarColapsado() {
    setColapsado((prev) => {
      const novo = !prev;
      try {
        window.localStorage.setItem(CHAVE_MENU_COLAPSADO, novo ? "1" : "0");
      } catch {
        // localStorage indisponível — a preferência só não persiste entre sessões.
      }
      return novo;
    });
  }

  return (
    <>
      <div className="glass-nav sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 px-4 py-3 lg:hidden dark:border-slate-700">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          className="glass-nav-texto flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-800"
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
        className={`glass-nav fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] shrink-0 flex-col overflow-y-auto transition-[transform,width] duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:max-w-none lg:translate-x-0 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        } ${colapsado ? "lg:w-20 menu-colapsado" : "lg:w-64"}`}
      >
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
          className="glass-nav-texto absolute right-3 top-3 z-10 rounded-lg border border-slate-200 bg-slate-100 p-1.5 lg:hidden dark:border-slate-700 dark:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Botão de recolher/expandir — só em telas lg+ (a gaveta mobile
            sempre mostra o menu completo). Preso na borda direita do <aside>,
            padrão comum de sidebars retráteis (ex.: VS Code, Notion). */}
        <button
          type="button"
          onClick={alternarColapsado}
          aria-label={colapsado ? "Expandir menu" : "Recolher menu"}
          title={colapsado ? "Expandir menu" : "Recolher menu"}
          className="glass-nav-texto absolute -right-3 top-16 z-10 hidden rounded-full border border-slate-200 bg-white p-1 shadow-sm hover:bg-slate-50 lg:flex dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {colapsado ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {menu}
      </aside>

      {children}
    </>
  );
}
