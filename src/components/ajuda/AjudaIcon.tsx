"use client";

import { useState } from "react";
import { AJUDA } from "@/lib/ajuda/conteudo";

// Ícone "?" reutilizável (Fase 24) — ao lado de um indicador, painel ou
// botão não óbvio, mostra um popover com título + explicação (o que é,
// pra que serve, como é calculado). O texto vive centralizado em
// src/lib/ajuda/conteudo.ts; aqui só cuida da interação (abrir/fechar).
// Se a chave não existir no dicionário, não renderiza nada (em vez de
// quebrar a tela) — só avisa no console em dev, pra pegar erro de digitação
// cedo sem arriscar produção.
export function AjudaIcon({ chave, className }: { chave: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const item = AJUDA[chave];

  if (!item) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`AjudaIcon: chave "${chave}" não encontrada em src/lib/ajuda/conteudo.ts`);
    }
    return null;
  }

  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Ajuda: ${item.titulo}`}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold leading-none text-slate-400 transition hover:border-frota-500 hover:text-frota-600"
      >
        ?
      </button>
      {aberto && (
        <>
          {/* Backdrop invisível só pra capturar clique fora e fechar o popover. */}
          <button
            type="button"
            aria-label="Fechar ajuda"
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left normal-case shadow-lg">
            <p className="text-xs font-semibold text-slate-900">{item.titulo}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.texto}</p>
          </div>
        </>
      )}
    </span>
  );
}
