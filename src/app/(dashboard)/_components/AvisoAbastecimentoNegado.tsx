"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ShieldAlert, X } from "lucide-react";
import { useBadgesMenu } from "./ProvedorBadgesMenu";

// Fase 5 PDV (03/10/2026, pedido do Daniel: notificação visual pro gestor
// decidir a liberação) — aviso flutuante quando entra um abastecimento
// NEGADO por regra do cliente aguardando liberação. Pega carona na contagem
// da bolinha do menu ("/abastecimentos-negados"), que já atualiza por
// Realtime: dispara quando o número SOBE em relação ao último visto (a
// primeira leitura só serve de linha de base, sem aviso). Não some sozinho —
// o pedido tem validade curta e o gestor precisa agir.
const CHAVE = "/abastecimentos-negados";

export function AvisoAbastecimentoNegado() {
  const ctx = useBadgesMenu();
  const [montado, setMontado] = useState(false);
  const [aviso, setAviso] = useState<number | null>(null);
  const anterior = useRef<number | null>(null);

  useEffect(() => setMontado(true), []);

  const inicial = ctx?.badges?.[CHAVE];
  useEffect(() => {
    if (anterior.current === null && typeof inicial === "number") anterior.current = inicial;
  }, [inicial]);

  const assinar = ctx?.assinar;
  useEffect(() => {
    if (!assinar) return;
    return assinar((badges) => {
      const atual = badges[CHAVE] ?? 0;
      const antes = anterior.current;
      anterior.current = atual;
      if (antes !== null && atual > antes) setAviso(atual);
      if (atual === 0) setAviso(null);
    });
  }, [assinar]);

  if (!montado || aviso === null) return null;

  return createPortal(
    <div
      aria-live="assertive"
      className="pointer-events-none fixed right-4 top-4 z-[70] w-[min(360px,calc(100vw-2rem))]"
    >
      <div
        role="alert"
        className="pointer-events-auto rounded-xl border border-slate-200 border-l-4 border-l-red-500 bg-white p-3 shadow-lg dark:border-slate-700 dark:border-l-red-400 dark:bg-slate-800"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Abastecimento aguardando sua liberação</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {aviso === 1 ? "1 abastecimento foi negado" : `${aviso} abastecimentos foram negados`} por regras do seu
              cliente. O motorista e o posto estão esperando — o pedido tem validade curta.
            </p>
            <Link
              href="/abastecimentos-negados"
              onClick={() => setAviso(null)}
              className="mt-2 inline-block text-xs font-semibold text-red-600 hover:underline dark:text-red-300"
            >
              Ver e decidir
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Fechar aviso"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
