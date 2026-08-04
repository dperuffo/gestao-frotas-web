"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { registrarAcessoMenuAcao } from "@/lib/menuFavoritos";

// Fase Acesso-Rápido-Favoritos (04/08/2026) — componente invisível, montado
// uma vez no layout do dashboard, que registra 1 acesso (pra frecência) toda
// vez que o usuário navega pra uma rota "rastreável" (ver HREFS_RASTREAVEIS
// em layout.tsx — só as rotas que também são item de algum menu; páginas de
// detalhe tipo /fretes/[id] não contam, só a lista /fretes). O `useRef`
// evita registrar duas vezes a mesma rota em re-renders sem navegação real
// (ex.: Server Action que revalida a página atual). Best-effort e
// silencioso — nunca deve interferir na navegação em si.
export function RastreadorAcessoMenu({ hrefsRastreaveis }: { hrefsRastreaveis: string[] }) {
  const pathname = usePathname();
  const ultimoRegistrado = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === ultimoRegistrado.current) return;
    if (!hrefsRastreaveis.includes(pathname)) return;
    ultimoRegistrado.current = pathname;
    registrarAcessoMenuAcao(pathname).catch(() => {});
  }, [pathname, hrefsRastreaveis]);

  return null;
}
