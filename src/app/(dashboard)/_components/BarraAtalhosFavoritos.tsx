"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { X, Zap } from "lucide-react";
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

  // Fase Acesso-Rápido-Destaque (13/08/2026, pedido do Daniel) — os pills
  // eram quase invisíveis (fundo branco sobre fundo branco/cinza claro,
  // borda cinza, ícone pequeno) — quem não soubesse que a barra existia
  // dificilmente reparava nela. Troca pra "chip" tingido na cor da marca
  // (mesmo espírito do IndicadorColorido: fundo leve + texto/ícone na cor),
  // com texto em negrito e ícone maior, mais fácil de notar de relance nas
  // 3 visões (posto/cliente/admin, que compartilham este mesmo componente
  // via (dashboard)/layout.tsx).
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-frota-600">
        <Zap className="h-3.5 w-3.5 fill-frota-500 text-frota-500" />
        Acesso rápido
      </span>
      {itens.map((item) => (
        <span
          key={item.href}
          className="group flex items-center gap-2 rounded-full border border-frota-100 bg-frota-50 py-2 pl-3.5 pr-2.5 text-sm font-semibold text-frota-800 shadow-sm transition hover:border-frota-500 hover:bg-frota-100 hover:shadow-md"
        >
          <Link href={item.href} className="flex items-center gap-2">
            {item.icon}
            {item.label}
          </Link>
          <button
            type="button"
            onClick={() => remover(item.href)}
            title="Remover do acesso rápido"
            className="rounded-full p-0.5 text-frota-400 opacity-0 transition hover:bg-frota-200 hover:text-frota-700 group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
