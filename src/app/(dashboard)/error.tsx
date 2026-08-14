"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Fase Observabilidade-Fundacao (14/08/2026, pedido do Daniel: "todo erro
// deve ter stack trace completa e contexto") — primeiro `error.tsx` da
// aplicação inteira (confirmado por busca: não existia nenhum antes). Sem
// isto, qualquer erro não tratado durante a renderização de uma tela do
// dashboard mostrava a tela branca padrão do Next.js — sem aviso pro
// usuário, e sem o Daniel nunca saber que aconteceu (o erro só ia pro
// console do navegador de quem estava usando, que ninguém olha). Este
// arquivo captura esse erro, mostra uma tela de recuperação, e relay o
// stack completo pro servidor via /api/log-cliente — assim fica gravado no
// log estruturado do Railway, com Request ID quando disponível.
//
// Component obrigatoriamente Client (Error Boundary do Next.js só funciona
// assim) — por isso não dá pra usar `logger.ts`/`headers()` direto aqui.
export default function ErroDashboard({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/log-cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensagem: error.message,
        stack: error.stack,
        digest: error.digest,
        pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
      // Não bloqueia a renderização da tela de erro por causa de uma
      // falha de rede ao tentar logar — best effort.
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="card max-w-md p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Algo deu errado nesta tela</h2>
        <p className="mt-2 text-sm text-gray-500">
          O erro já foi registrado automaticamente. Você pode tentar novamente ou voltar para o
          início.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-gray-400">Código de referência: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => reset()} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
          <a href="/dashboard" className="btn-secondary">
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}
