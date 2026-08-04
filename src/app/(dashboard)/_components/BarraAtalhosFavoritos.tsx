"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { alternarFavoritoMenuAcao } from "@/lib/menuFavoritos";

// Fase Acesso-Rápido-Favoritos — bugfix pós-deploy (04/08/2026): `icon` era
// tipado como `LucideIcon` (a referência da função/componente) e o layout.tsx
// (Server Component) passava essa referência direto pra este componente
// ("use client"). Função crua não pode atravessar a fronteira
// servidor→cliente do React Server Components — daí o erro em produção
// "Functions cannot be passed directly to Client Components...", que
// derrubava TODA página do dashboard assim que qualquer usuário tinha 1
// favorito registrado. Corrigido recebendo o ícone já RENDERIZADO
// (`ReactNode`, um elemento React — isso sim pode atravessar a fronteira,
// é o mesmo mecanismo que `children` usa) em vez da função crua.
export type ItemAtalho = { href: string; label: string; icon?: ReactNode };

// Fase Acesso-Rápido-Favoritos (04/08/2026, pedido do Daniel) — barra
// horizontal de atalhos no topo do conteúdo (escolha explícita dele: não no
// menu lateral) com as telas mais usadas (frecência) ou fixadas manualmente
// deste usuário — ver menu_favoritos/favoritos_menu_do_usuario no banco e
// GrupoMenuLateral.tsx/BotaoFavoritoMenu.tsx pro lado "fixar manualmente".
// Some sozinha (sem placeholder vazio) pra usuário novo, sem uso registrado
// ainda. Estado local otimista ao remover: some da barra na hora, sem
// esperar o round-trip da Server Action — mesmo padrão de AvisosSino.
export function BarraAtalhosFavoritos({ itensIniciais }: { itensIniciais: ItemAtalho[] }) {
  const [itens, setItens] = useState(itensIniciais);
  const [, startTransition] = useTransition();

  if (itens.length === 0) return null;

  function remover(href: string) {
    const itemRemovido = itens.find((i) => i.href === href);
    setItens((prev) => prev.filter((i) => i.href !== href));
    startTransition(() => {
      alternarFavoritoMenuAcao(href, false).catch(() => {
        // Falhou — devolve o item pra barra em vez de escondê-lo por causa
        // de uma falha de rede pontual (só remove de verdade se a Server
        // Action confirmar).
        if (itemRemovido) setItens((prev) => [...prev, itemRemovido]);
      });
    });
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Acesso rápido</span>
      {itens.map((item) => (
        <span
          key={item.href}
          className="group flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1.5 pl-3 pr-2 text-sm text-slate-700 shadow-sm transition hover:border-frota-300"
        >
          <Link href={item.href} className="flex items-center gap-1.5">
            {item.icon}
            {item.label}
          </Link>
          <button
            type="button"
            onClick={() => remover(item.href)}
            title="Remover do acesso rápido"
            className="rounded-full p-0.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
