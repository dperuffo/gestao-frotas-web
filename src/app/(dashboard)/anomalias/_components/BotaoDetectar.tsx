"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { executarDeteccaoAnomaliasAcao } from "../actions";

// Fase 27.46 — botão "Detectar agora": roda as 4 regras sob demanda pra
// empresa selecionada (ou, se `todasEmpresas` for true — só disponível pro
// admin sem cliente escolhido — pra todas de uma vez). Reexecutar é seguro:
// a detecção é idempotente, não duplica achado já gravado.
export function BotaoDetectar({ empresaId, todasEmpresas }: { empresaId: string | null; todasEmpresas?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setErro(null);
    setMensagem(null);
    startTransition(async () => {
      const resultado = await executarDeteccaoAnomaliasAcao(todasEmpresas ? null : empresaId);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      const n = resultado.inseridas ?? 0;
      setMensagem(n > 0 ? `${n} anomalia(s) nova(s) encontrada(s).` : "Nenhuma anomalia nova encontrada.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleClick} disabled={isPending} className="btn-primary">
        {isPending ? "Analisando..." : todasEmpresas ? "Detectar agora (todas as empresas)" : "Detectar agora"}
      </button>
      {mensagem && <p className="text-xs text-slate-500">{mensagem}</p>}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
