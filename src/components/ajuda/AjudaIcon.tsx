"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AJUDA } from "@/lib/ajuda/conteudo";

const LARGURA_CARD = 256; // w-64
const MARGEM_VIEWPORT = 8;

// Ícone "?" reutilizável (Fase 24) — ao lado de um indicador, painel ou
// botão não óbvio, mostra um popover com título + explicação (o que é,
// pra que serve, como é calculado). O texto vive centralizado em
// src/lib/ajuda/conteudo.ts; aqui só cuida da interação (abrir/fechar).
// Se a chave não existir no dicionário, não renderiza nada (em vez de
// quebrar a tela) — só avisa no console em dev, pra pegar erro de digitação
// cedo sem arriscar produção.
//
// Fase 27.148 — achado do Daniel (print da coluna "Score" em Roteirização,
// 1ª coluna da tabela): o card abria com `position: absolute` DENTRO do
// fluxo normal, centralizado embaixo do ícone com largura fixa (w-64 =
// 256px). Perto da borda esquerda da tela — como o ícone da coluna Score,
// a 1ª coluna de várias tabelas — metade do card ficava fora da área
// visível, cortada pelo `overflow-x-auto` do card/tabela pai (não dava só
// pra "empurrar" a posição, o ancestral corta o que passa da borda).
// Corrigido renderizando o popover num portal (direto em document.body,
// fora do fluxo/scroll da tabela) com posição calculada em coordenadas de
// viewport a partir do próprio ícone, travada pra nunca passar das bordas
// da tela.
export function AjudaIcon({ chave, className }: { chave: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const item = AJUDA[chave];

  useEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const rect = botaoRef.current.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - LARGURA_CARD / 2;
    left = Math.max(MARGEM_VIEWPORT, Math.min(left, window.innerWidth - LARGURA_CARD - MARGEM_VIEWPORT));
    setPosicao({ top: rect.bottom + 8, left });

    // Fecha ao rolar (a posição calculada acima é fixa — sem isso, o card
    // ficaria "flutuando" longe do ícone assim que a página rolasse).
    function fechar() {
      setAberto(false);
    }
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  if (!item) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`AjudaIcon: chave "${chave}" não encontrada em src/lib/ajuda/conteudo.ts`);
    }
    return null;
  }

  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Ajuda: ${item.titulo}`}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold leading-none text-slate-400 transition hover:border-frota-500 hover:text-frota-600"
      >
        ?
      </button>
      {aberto &&
        posicao &&
        createPortal(
          <>
            {/* Backdrop invisível só pra capturar clique fora e fechar o popover. */}
            <button
              type="button"
              aria-label="Fechar ajuda"
              tabIndex={-1}
              onClick={() => setAberto(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              style={{ top: posicao.top, left: posicao.left, width: LARGURA_CARD }}
              className="fixed z-50 rounded-lg border border-slate-200 bg-white p-3 text-left normal-case shadow-lg"
            >
              <p className="text-xs font-semibold text-slate-900">{item.titulo}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.texto}</p>
            </div>
          </>,
          document.body
        )}
    </span>
  );
}
