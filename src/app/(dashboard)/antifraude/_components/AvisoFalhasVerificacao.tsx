"use client";

import { useTransition } from "react";
import { marcarFalhasAntifraudeComoLidasAcao } from "../actions";

type FalhaResumo = { id: string; detalhe: string; criado_em: string };

export function AvisoFalhasVerificacao({ falhas }: { falhas: FalhaResumo[] }) {
  const [isPending, startTransition] = useTransition();

  if (falhas.length === 0) return null;

  function handleMarcarLidas() {
    startTransition(() => {
      marcarFalhasAntifraudeComoLidasAcao();
    });
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-800">
            {falhas.length} abastecimento{falhas.length > 1 ? "s" : ""} autorizado{falhas.length > 1 ? "s" : ""} sem
            verificação completa
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Por segurança, foram liberados automaticamente (nunca travamos a operação por uma falha nossa) — vale
            revisar antes dos próximos abastecimentos.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {falhas.slice(0, 5).map((f) => (
              <li key={f.id}>
                • {new Date(f.criado_em).toLocaleString("pt-BR")} — {f.detalhe}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={handleMarcarLidas}
          disabled={isPending}
          className="shrink-0 whitespace-nowrap text-xs font-medium text-amber-800 hover:underline disabled:opacity-50"
        >
          {isPending ? "..." : "Marcar como lidas"}
        </button>
      </div>
    </div>
  );
}
