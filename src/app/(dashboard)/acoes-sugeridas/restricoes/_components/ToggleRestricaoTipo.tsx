"use client";

import { useTransition } from "react";
import { salvarConfigRestricaoAcao } from "../../actions";

export function ToggleRestricaoTipo({
  empresaId,
  tipo,
  ativo,
}: {
  empresaId: string;
  tipo: string;
  ativo: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const pergunta = ativo
      ? "Desativar o bloqueio automático de abastecimento para este tipo de anomalia?"
      : "Ativar o bloqueio automático de abastecimento para este tipo de anomalia? Toda vez que uma ação sugerida desse tipo for aprovada, a placa/motorista afetada fica impedida de abastecer até alguém liberar manualmente.";
    if (!window.confirm(pergunta)) return;
    startTransition(async () => {
      await salvarConfigRestricaoAcao(empresaId, tipo, !ativo);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        ativo ? "bg-frota-600" : "bg-slate-300"
      }`}
      aria-pressed={ativo}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          ativo ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
