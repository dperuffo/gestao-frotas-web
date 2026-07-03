"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirAbastecimento } from "../actions";

export function ExcluirAbastecimento({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!window.confirm("Excluir este registro de abastecimento? Essa ação não pode ser desfeita.")) {
      return;
    }
    startTransition(async () => {
      await excluirAbastecimento(id);
      router.push("/abastecimentos");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "Excluindo..." : "Excluir"}
    </button>
  );
}
