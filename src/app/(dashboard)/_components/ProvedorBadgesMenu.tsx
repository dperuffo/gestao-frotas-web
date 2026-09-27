"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { contarBadgesMenuAcao } from "./badgesMenuActions";

// Fase Bolinhas-Automáticas (27/09/2026) — ver badgesMenuActions.ts para o
// diagnóstico. Guarda as contagens das bolinhas do menu no navegador e as
// busca de novo:
//   1. ao trocar de tela (a página aberta pode ter marcado itens como vistos);
//   2. ao voltar para a aba do sistema;
//   3. a cada 60s enquanto a aba estiver visível.
// Os valores iniciais vêm do layout (renderizado no servidor), então a
// primeira pintura continua sem "piscar". Se o layout for re-renderizado
// (ex.: resposta de uma Server Action), os valores novos também são adotados.

const INTERVALO_MS = 60_000;
const INTERVALO_MINIMO_MS = 5_000; // evita rajadas (foco + navegação juntos)

type Assinante = (badges: Record<string, number>) => void;

const BadgesMenuContext = createContext<{
  badges: Record<string, number>;
  assinar: (fn: Assinante) => () => void;
} | null>(null);

export function ProvedorBadgesMenu({
  inicial,
  children,
}: {
  inicial: Record<string, number>;
  children: React.ReactNode;
}) {
  const [badges, setBadges] = useState(inicial);
  const pathname = usePathname();
  const ultimaBusca = useRef(0);
  const emAndamento = useRef(false);
  const assinantes = useRef(new Set<Assinante>());

  // Layout re-renderizado no servidor com números novos: adota.
  const chaveInicial = JSON.stringify(inicial);
  useEffect(() => {
    setBadges(JSON.parse(chaveInicial));
  }, [chaveInicial]);

  const atualizar = useCallback(async (forcar = false) => {
    const agora = Date.now();
    if (emAndamento.current) return;
    if (!forcar && agora - ultimaBusca.current < INTERVALO_MINIMO_MS) return;
    emAndamento.current = true;
    ultimaBusca.current = agora;
    try {
      const novos = await contarBadgesMenuAcao();
      setBadges(novos);
      assinantes.current.forEach((fn) => fn(novos));
    } catch {
      // Sem rede / sessão expirada: mantém os números atuais.
    } finally {
      emAndamento.current = false;
    }
  }, []);

  // 1. Troca de tela (pula a primeira montagem: o layout acabou de contar).
  const primeiraMontagem = useRef(true);
  useEffect(() => {
    if (primeiraMontagem.current) {
      primeiraMontagem.current = false;
      ultimaBusca.current = Date.now();
      return;
    }
    const t = window.setTimeout(() => void atualizar(true), 400);
    return () => window.clearTimeout(t);
  }, [pathname, atualizar]);

  // 2. Volta para a aba + 3. intervalo enquanto visível.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void atualizar();
    };
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") void atualizar();
    }, INTERVALO_MS);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [atualizar]);

  const assinar = useCallback((fn: Assinante) => {
    assinantes.current.add(fn);
    return () => {
      assinantes.current.delete(fn);
    };
  }, []);

  return <BadgesMenuContext.Provider value={{ badges, assinar }}>{children}</BadgesMenuContext.Provider>;
}

export function useBadgesMenu() {
  return useContext(BadgesMenuContext);
}

// Bolinha vermelha de um item do menu. `inicial` é o número que o servidor
// calculou; dentro do provedor, o valor mais recente do navegador prevalece.
export function BadgeMenu({ href, inicial }: { href: string; inicial: number }) {
  const ctx = useContext(BadgesMenuContext);
  const valor = ctx && href in ctx.badges ? ctx.badges[href] : inicial;
  if (!valor || valor <= 0) return null;
  return (
    <span
      className="menu-item-extra flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white"
      aria-label={`${valor} pendente${valor > 1 ? "s" : ""}`}
    >
      {valor > 99 ? "99+" : valor}
    </span>
  );
}
