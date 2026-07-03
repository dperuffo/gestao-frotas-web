"use client";

import { useState, useTransition } from "react";
import { responderAvaliacaoAcao } from "../actions";

// Caixa de resposta do admin a uma avaliação — mostra a resposta já
// enviada (se houver) com opção de editar, ou o formulário de resposta
// direto. Mesmo padrão useState + useTransition do resto do app.
export function RespostaAvaliacao({
  avaliacaoId,
  respostaAtual,
}: {
  avaliacaoId: string;
  respostaAtual: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(respostaAtual ?? "");
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function enviar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await responderAvaliacaoAcao(avaliacaoId, texto);
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      setEditando(false);
    });
  }

  if (!editando) {
    return (
      <div className="mt-3 rounded-lg bg-frota-50 px-3 py-2">
        {respostaAtual ? (
          <>
            <p className="text-xs font-semibold text-frota-700">Sua resposta</p>
            <p className="mt-1 text-sm text-slate-700">{respostaAtual}</p>
          </>
        ) : (
          <p className="text-xs text-slate-500">Ainda sem resposta.</p>
        )}
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="mt-2 text-xs font-medium text-frota-600 hover:underline"
        >
          {respostaAtual ? "Editar resposta" : "Responder"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        className="input"
        placeholder="Escreva a resposta para o cliente..."
      />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={enviar} disabled={isPending} className="btn-primary text-xs">
          {isPending ? "Enviando..." : "Enviar resposta"}
        </button>
        <button type="button" onClick={() => setEditando(false)} className="btn-secondary text-xs">
          Cancelar
        </button>
      </div>
    </div>
  );
}
