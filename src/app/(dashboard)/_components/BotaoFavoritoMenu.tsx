"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { Star } from "lucide-react";
import { alternarFavoritoMenuAcao } from "@/lib/menuFavoritos";

// Fase Acesso-Rápido-Favoritos (04/08/2026) — estrela ao lado de cada item
// do menu lateral (ver GrupoMenuLateral.tsx), pra fixar/remover manualmente
// do acesso rápido — a "camada humana" por cima da sugestão automática por
// uso (frecência, calculada no banco). Só fica visível no hover da linha
// (`group-hover`, classe `group` no <li> pai) pra não poluir visualmente o
// menu padrão pra quem nunca usa o recurso.
export function BotaoFavoritoMenu({ href, favoritadoInicial }: { href: string; favoritadoInicial: boolean }) {
  const [favoritado, setFavoritado] = useState(favoritadoInicial);
  const [isPending, startTransition] = useTransition();

  function alternar(e: MouseEvent<HTMLButtonElement>) {
    // Impede que o clique na estrela também dispare a navegação do <Link>
    // vizinho (ela fica dentro do mesmo <li>, lado a lado).
    e.preventDefault();
    e.stopPropagation();
    const novoValor = !favoritado;
    setFavoritado(novoValor);
    startTransition(() => {
      alternarFavoritoMenuAcao(href, novoValor).catch(() => setFavoritado(!novoValor));
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={isPending}
      title={favoritado ? "Remover do acesso rápido" : "Fixar no acesso rápido"}
      className="shrink-0 rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-900/5 hover:text-amber-500 group-hover:opacity-100 focus-visible:opacity-100"
    >
      <Star className={`h-3.5 w-3.5 ${favoritado ? "fill-amber-400 text-amber-400" : ""}`} />
    </button>
  );
}
