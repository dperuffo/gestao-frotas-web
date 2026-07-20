"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { executarDeteccaoAcoesSugeridasAcao } from "../actions";

// Mesmo espírito do BotaoDetectar de /anomalias: roda as 3 detecções (CNH
// vencida, posto acima da média, hodômetro fora do padrão) sob demanda.
// Idempotente — reexecutar não duplica sugestão já pendente.
export function BotaoDetectarAcoes({ empresaId, todasEmpresas }: { empresaId: string | null; todasEmpresas?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setErro(null);
    setMensagem(null);
    startTransition(async () => {
      const resultado = await executarDeteccaoAcoesSugeridasAcao(todasEmpresas ? null : empresaId);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      const n = resultado.inseridas ?? 0;
      setMensagem(n > 0 ? `${n} oportunidade(s) nova(s) encontrada(s).` : "Nenhuma oportunidade nova encontrada.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleClick} disabled={isPending} className="btn-primary">
        {isPending ? "Analisando..." : todasEmpresas ? "Detectar oportunidades (todas as empresas)" : "Detectar oportunidades"}
      </button>
      {mensagem && <p className="text-xs text-slate-500">{mensagem}</p>}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
