"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirPosto } from "../actions";

export function ExcluirPosto({ cnpj }: { cnpj: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!window.confirm("Excluir este posto? Essa ação não pode ser desfeita.")) return;
    startTransition(async () => {
      await excluirPosto(cnpj);
      router.push("/postos");
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
