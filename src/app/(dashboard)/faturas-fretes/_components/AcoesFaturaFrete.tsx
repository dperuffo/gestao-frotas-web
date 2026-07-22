"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarFaturaFreteAcao, gerarCobrancaFaturaFreteAcao, marcarFaturaFretePagaAcao } from "../actions";

export function GerarCobrancaButton({ faturaId, empresaId }: { faturaId: string; empresaId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await gerarCobrancaFaturaFreteAcao(faturaId, empresaId);
      if (resultado?.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={isPending} className="btn-secondary text-sm disabled:opacity-50">
        {isPending ? "Gerando..." : "💳 Gerar cobrança (boleto simulado + PIX)"}
      </button>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}

export function MarcarFaturaFretePagaButton({ faturaId, empresaId }: { faturaId: string; empresaId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Marcar esta fatura como paga?")) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await marcarFaturaFretePagaAcao(faturaId, empresaId);
      if (resultado?.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={isPending} className="btn-primary text-sm disabled:opacity-50">
        {isPending ? "Confirmando..." : "✓ Marcar como paga"}
      </button>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}

export function CancelarFaturaFreteButton({ faturaId, empresaId }: { faturaId: string; empresaId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Cancelar esta fatura? Os CT-es incluídos voltam a ficar disponíveis pra uma fatura futura.")) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await cancelarFaturaFreteAcao(faturaId, empresaId);
      if (resultado?.erro) setErro(resultado.erro);
      else router.refresh();
    });
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={isPending} className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50">
        {isPending ? "Cancelando..." : "Cancelar fatura"}
      </button>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
