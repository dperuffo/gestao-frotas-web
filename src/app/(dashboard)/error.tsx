"use client";

import { useEffect } from "react";
import Link from "next/link";

// Fase 27.22 — error boundary do Next.js pra qualquer página dentro do
// dashboard. Até aqui, um erro não tratado em qualquer tela (ex.: o crash de
// anexo de chamado que motivou essa fase) caía na página genérica do Next
// ("Application error: a server-side exception has occurred..."), sem
// contexto nem caminho de volta — o usuário só tinha a opção de fechar a aba
// ou recarregar tudo. Esse arquivo intercepta qualquer erro dentro de
// `(dashboard)/**` e mostra uma tela com uma explicação simples, um botão
// de tentar de novo (`reset()`, que tenta re-renderizar sem recarregar a
// página) e um link de volta ao Dashboard — o menu lateral (definido em
// layout.tsx) continua visível normalmente, porque o erro só derruba o
// conteúdo da página, não o layout ao redor.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] erro não tratado:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-md space-y-4 p-8 text-center">
        <p className="text-3xl">⚠️</p>
        <h1 className="text-lg font-semibold text-slate-900">Algo deu errado nesta tela</h1>
        <p className="text-sm text-slate-500">
          Não conseguimos concluir essa ação. Isso pode ter sido algo pontual — tente de novo, ou
          volte ao Dashboard e tente novamente a partir de lá.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400">
            Código do erro: <span className="font-mono">{error.digest}</span> — informe esse código
            se abrir um chamado sobre o problema.
          </p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={() => reset()} className="btn-primary">
            Tentar novamente
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
