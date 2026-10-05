"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ClipboardCheck, X } from "lucide-react";
import { useBadgesMenu } from "./ProvedorBadgesMenu";

// 05/10/2026 (pedido do Daniel: "pedidos de ajuste não geram notificação pro
// gestor") — aviso flutuante quando chega um pedido de ajuste de abastecimento
// PDV aguardando a decisão deste usuário (contraparte de quem pediu). Pega
// carona na contagem da bolinha do menu ("/ajustes-pdv"), atualizada por
// Realtime: dispara quando o número SOBE (a primeira leitura é só linha de base).
const CHAVE = "/ajustes-pdv";

export function AvisoAjustePdv() {
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
        className="pointer-events-auto rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-3 shadow-lg dark:border-slate-700 dark:border-l-amber-400 dark:bg-slate-800"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Pedido de ajuste aguardando sua decisão</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {aviso === 1 ? "1 pedido de ajuste de abastecimento" : `${aviso} pedidos de ajuste de abastecimento`} aguardando
              você aprovar ou recusar. O abastecimento fica em ajuste até a decisão.
            </p>
            <Link
              href="/ajustes-pdv"
              onClick={() => setAviso(null)}
              className="mt-2 inline-block text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300"
            >
              Ver pedidos
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
