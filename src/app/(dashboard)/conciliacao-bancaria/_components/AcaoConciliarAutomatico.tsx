"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { conciliarAutomaticoAcao } from "../actions";

// Fase Conciliacao-IA (27/08/2026, pedido do Daniel: "revisão humana só nas
// exceções") — botão de conciliação em lote pra quando há EXATAMENTE 1
// candidato de "alta confiança" (valor exato + data próxima + nome do
// fornecedor batendo na descrição do extrato). Ambíguo (0 ou 2+ candidatos
// de alta confiança) fica de fora do lote — vira exceção pra revisão manual
// na lista abaixo, que é exatamente o comportamento pedido.
export function AcaoConciliarAutomatico({ empresaId, quantidade }: { empresaId: string; quantidade: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | undefined>();

  if (quantidade === 0) return null;

  function executar() {
    setMensagem(undefined);
    startTransition(async () => {
      const resultado = await conciliarAutomaticoAcao(empresaId);
      setMensagem(resultado.sucesso ?? resultado.erro);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {mensagem && <span className="text-xs text-slate-500">{mensagem}</span>}
      <button
        type="button"
        disabled={isPending}
        onClick={executar}
        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {isPending ? "Conciliando..." : `Conciliar automaticamente (${quantidade} de alta confiança)`}
      </button>
    </div>
  );
}
