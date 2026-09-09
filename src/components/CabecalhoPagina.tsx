import type { ReactNode } from "react";

// Fase Design-ProFrotas-Divergencias (09/09/2026) — header em gradiente
// slate/laranja (mesmo do HTML de referência do relatório de divergências
// ProFrotas), extraído em componente compartilhado pra não repetir o
// gradiente inline em cada uma das ~150 telas (mesmo raciocínio do .card
// central em globals.css: trocar aqui cascateia pro app inteiro). Texto
// SEMPRE branco/claro sobre esse fundo — pedido explícito do Daniel (não
// gostou de texto escuro sobre fundo colorido/escuro).
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl p-6 text-white"
      style={{
        background:
          "radial-gradient(circle at 86% 0, rgba(222,96,36,.55), transparent 30%), linear-gradient(135deg, #333c4d, #4e5d77 60%, #66748d)",
      }}
    >
      <div>
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-white">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-white/80">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>
  );
}
