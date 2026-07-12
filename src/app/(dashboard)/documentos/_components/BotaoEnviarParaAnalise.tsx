"use client";

import { useState, useTransition } from "react";
import { enviarParaAnaliseAcao } from "../actions";
import type { StatusDocumentacao } from "@/lib/empresasDocumentos";

// Fase 27.149 — envia a documentação pra análise do admin (a validação de
// "está tudo completo?" acontece no servidor, em enviarDocumentacaoParaAnalise
// — src/lib/empresasDocumentos.ts — não só aqui na tela).
export function BotaoEnviarParaAnalise({ empresaId, status }: { empresaId: string; status: StatusDocumentacao }) {
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (status === "pendente") {
    return <p className="text-sm text-amber-700">Documentação em análise pelo admin — nenhuma ação necessária agora.</p>;
  }
  if (status === "aprovada") {
    return <p className="text-sm text-green-700">Documentação aprovada — nenhuma ação necessária.</p>;
  }

  function enviar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      const resultado = await enviarParaAnaliseAcao(empresaId);
      if (resultado.erro) setErro(resultado.erro);
      else setSucesso(true);
    });
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        Depois de enviar todos os documentos acima (empresa + cada sócio), mande pra análise do admin.
      </p>
      <button type="button" onClick={enviar} disabled={isPending} className="btn-primary">
        {isPending ? "Enviando..." : "Enviar para análise"}
      </button>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="mt-2 text-sm text-green-700">Enviado! Aguarde a análise do admin.</p>}
    </div>
  );
}
