"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { contarBadgesMenuAcao } from "./badgesMenuActions";

// Fase Bolinhas-Automáticas (27/09/2026) — ver badgesMenuActions.ts para o
// diagnóstico. Guarda as contagens das bolinhas do menu no navegador e as
// busca de novo:
//   1. ao trocar de tela (a página aberta pode ter marcado itens como vistos);
//   2. ao voltar para a aba do sistema;
//   3. a cada 60s enquanto a aba estiver visível (rede de segurança);
//   4. (Fase Bolinhas-Tempo-Real, mesmo dia) na hora, quando o Supabase
//      Realtime avisa de INSERT/UPDATE nas tabelas abaixo.
// Os valores iniciais vêm do layout (renderizado no servidor), então a
// primeira pintura continua sem "piscar". Quem precisa reagir ao mesmo ciclo
// (sino de avisos, aviso de novo abastecimento) usa `assinar`.

const INTERVALO_MS = 60_000;
const INTERVALO_MINIMO_MS = 5_000; // evita rajadas (foco + navegação juntos)
const AGRUPAR_EVENTOS_MS = 1_500; // várias linhas inseridas juntas = 1 atualização

// Tabelas publicadas em supabase_realtime (migration
// realtime_badges_e_avisos_abastecimento). Todas com RLS por empresa: cada
// usuário só recebe eventos das próprias empresas.
const TABELAS_TEMPO_REAL = [
  "profrotas_abastecimentos",
  "abastecimentos_externos",
  "abastecimentos_internos",
  "tickets",
  "acoes_sugeridas",
  // Fase 5 PDV (03/10/2026) — abastecimento negado por regra do cliente
  // aguardando liberação do gestor.
  "abastecimentos_pdv",
] as const;

type Assinante = (badges: Record<string, number>) => void;

const BadgesMenuContext = createContext<{
  badges: Record<string, number>;
  assinar: (fn: Assinante) => () => void;
} | null>(null);

export function ProvedorBadgesMenu({
  inicial,
  visaoGlobal = false,
  children,
}: {
  inicial: Record<string, number>;
  // admin/analista: RLS libera todas as empresas, então só escuta o tempo
  // real do cliente atual (?empresa=), nunca da base inteira.
  visaoGlobal?: boolean;
  children: React.ReactNode;
}) {
  const [badges, setBadges] = useState(inicial);
  const pathname = usePathname();
  const empresaAtual = useSearchParams().get("empresa");
  const ultimaBusca = useRef(0);
  const emAndamento = useRef(false);
  const pendente = useRef(false);
  const assinantes = useRef(new Set<Assinante>());

  // Layout re-renderizado no servidor com números novos: adota.
  const chaveInicial = JSON.stringify(inicial);
  useEffect(() => {
    setBadges(JSON.parse(chaveInicial));
  }, [chaveInicial]);

  const atualizar = useCallback(async (forcar = false) => {
    const agora = Date.now();
    if (emAndamento.current) {
      // Chegou evento durante uma busca: roda de novo ao terminar.
      if (forcar) pendente.current = true;
      return;
    }
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
      if (pendente.current) {
        pendente.current = false;
        void atualizar(true);
      }
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

  // 4. Tempo real. O evento em si só serve de "cutucada": os números vêm
  // sempre de contarBadgesMenuAcao (mesma regra de negócio de sempre).
  useEffect(() => {
    if (visaoGlobal && !empresaAtual) return;
    const filtro = empresaAtual ? `empresa_id=eq.${empresaAtual}` : undefined;
    const supabase = createClient();
    let timer: number | undefined;
    const cutucar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void atualizar(true), AGRUPAR_EVENTOS_MS);
    };
    let canal = supabase.channel(`menu-badges:${empresaAtual ?? "minhas"}:${Math.random().toString(36).slice(2, 8)}`);
    for (const tabela of TABELAS_TEMPO_REAL) {
      for (const evento of ["INSERT", "UPDATE"] as const) {
        canal = canal.on(
          "postgres_changes",
          { event: evento, schema: "public", table: tabela, ...(filtro ? { filter: filtro } : {}) },
          cutucar
        );
      }
    }
    canal.subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(canal);
    };
  }, [visaoGlobal, empresaAtual, atualizar]);

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
