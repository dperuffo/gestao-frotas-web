"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirInteracaoAcao } from "../../actions";

export function BotaoExcluirInteracao({ interacaoId, clienteId, empresaId }: { interacaoId: string; clienteId: string; empresaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir este registro de interação?")) return;
    startTransition(async () => {
      await excluirInteracaoAcao(interacaoId, clienteId, empresaId);
      router.refresh();
    });
  }

  return (
    <button type="button" disabled={isPending} onClick={excluir} className="text-xs text-red-600 hover:underline disabled:opacity-50">
      Excluir
    </button>
  );
}
