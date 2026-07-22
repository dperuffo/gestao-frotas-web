"use client";

import { useState, useTransition } from "react";
import { converterCotacaoEmFreteAcao } from "../actions";

export function ConverterCotacaoButton({ id, empresaId }: { id: string; empresaId: string }) {
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await converterCotacaoEmFreteAcao(id, empresaId);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={isPending} className="btn-primary disabled:opacity-50">
        {isPending ? "Convertendo..." : "🚚 Converter em frete"}
      </button>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
