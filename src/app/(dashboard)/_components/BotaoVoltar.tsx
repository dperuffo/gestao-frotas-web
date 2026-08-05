"use client";

import { useRouter } from "next/navigation";

// Fase Botão-Voltar (04/08/2026) — pedido do Daniel: padronizar o link de
// "Voltar" nas telas de detalhe/imersão do dashboard. Antes dessa fase,
// ~11 das ~38 telas de detalhe já tinham um link caseiro (cada uma com
// classe, posição e rótulo diferentes — ver fretes/[id], chamados/[id],
// negociacoes/[id], tabelas-frete/[id]) e o restante não tinha nada.
//
// Bugfix (04/08/2026, mesmo dia) — achado real do Daniel: entrou no detalhe
// de um abastecimento a partir da lista JÁ FILTRADA por um cliente
// (`/abastecimentos?empresa=X`), clicou em "Voltar" e caiu na tela de
// "selecione o cliente" (`/abastecimentos` sem `empresa`), não na lista
// filtrada de onde ele veio. Causa: a primeira versão deste componente usava
// um `href` fixo por tela (ex.: sempre `/abastecimentos`), que não tinha
// como saber qual filtro/página/aba estava ativa na tela anterior — "Voltar"
// tem que voltar pra tela anterior de verdade, não pra uma rota-lista
// genérica adivinhada.
//
// Corrigido virando Client Component e usando `router.back()` (histórico
// real do navegador) como caminho principal — preserva automaticamente
// query string, scroll e qualquer estado da tela anterior, sem esta
// aplicação precisar saber ou reconstruir esse estado. `href` continua
// existindo só como FALLBACK pros casos em que não há histórico de navegação
// dentro do app (link direto, aba nova, refresh) — mesmo espírito do guard
// `context.canPop() ? context.pop() : context.go(fallback)` já usado no PWA
// Flutter (ver fase Botão-Voltar do repo estudo-de-rede).
export function BotaoVoltar({ href, label = "Voltar" }: { href: string; label?: string }) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(href);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mb-4 inline-flex items-center gap-1 text-sm text-frota-600 hover:underline"
    >
      ← {label}
    </button>
  );
}
