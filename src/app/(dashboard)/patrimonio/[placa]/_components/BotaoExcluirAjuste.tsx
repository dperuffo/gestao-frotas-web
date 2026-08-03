"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirAjusteAcao } from "../../actions";

export function BotaoExcluirAjuste({ ajusteId, placa, empresaId }: { ajusteId: string; placa: string; empresaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir este ajuste do patrimônio?")) return;
    startTransition(async () => {
      await excluirAjusteAcao(ajusteId, placa, empresaId);
      router.refresh();
    });
  }

  return (
    <button type="button" disabled={isPending} onClick={excluir} className="whitespace-nowrap text-xs text-red-600 hover:underline disabled:opacity-50">
      Excluir
    </button>
  );
}
