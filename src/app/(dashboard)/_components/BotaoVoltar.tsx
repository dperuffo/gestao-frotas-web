import Link from "next/link";

// Fase Botão-Voltar (04/08/2026) — pedido do Daniel: padronizar o link de
// "Voltar" nas telas de detalhe/imersão do dashboard. Antes dessa fase,
// ~11 das ~38 telas de detalhe já tinham um link caseiro (cada uma com
// classe, posição e rótulo diferentes — ver fretes/[id], chamados/[id],
// negociacoes/[id], tabelas-frete/[id]) e o restante não tinha nada.
//
// Server Component de propósito (sem "use client"): quase todas as páginas
// de detalhe são Server Components async que buscam dados via Supabase, e
// `router.back()` exigiria virar Client Component só por causa do botão.
// `href` explícito também é mais previsível que `history.back()` (não
// depende de como o usuário chegou na tela) e preserva o padrão já usado
// nos links caseiros de manter query params (`?empresa=${empresaId}`).
export function BotaoVoltar({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1 text-sm text-frota-600 hover:underline">
      ← {label}
    </Link>
  );
}
