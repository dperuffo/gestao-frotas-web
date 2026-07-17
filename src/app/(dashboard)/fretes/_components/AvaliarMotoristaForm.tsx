"use client";

import { useState, useTransition } from "react";
import { avaliarMotoristaAcao } from "../actions";

export function AvaliarMotoristaForm({ freteId, empresaId }: { freteId: string; empresaId: string }) {
  const [estrelas, setEstrelas] = useState(5);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function enviar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await avaliarMotoristaAcao(freteId, empresaId, estrelas, comentario.trim() || null);
      if (resultado?.erro) setErro(resultado.erro);
      else setEnviado(true);
    });
  }

  if (enviado) return <p className="text-sm text-status-ativo">Avaliação enviada. Obrigado!</p>;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setEstrelas(n)}
            className={`text-2xl leading-none ${n <= estrelas ? "text-amber-400" : "text-slate-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        placeholder="Comentário (opcional)"
        className="input text-sm"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button type="button" onClick={enviar} disabled={isPending} className="btn-primary text-sm">
        {isPending ? "Enviando..." : "Avaliar motorista"}
      </button>
    </div>
  );
}
