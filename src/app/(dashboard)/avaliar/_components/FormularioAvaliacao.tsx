"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Star } from "lucide-react";
import { enviarAvaliacaoAcao } from "../actions";
import { rotuloNota } from "@/lib/avaliacoes";

// Formulário de avaliação da plataforma — estrelas clicáveis (1 a 5) +
// observações opcionais. Mesmo padrão de formulário do resto do app
// (useState + useTransition, sem useActionState) pra ficar consistente com
// /cadastro e afins.
export function FormularioAvaliacao({ empresaId }: { empresaId: string | null }) {
  const [estrelas, setEstrelas] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(undefined);
    setSucesso(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado = await enviarAvaliacaoAcao(undefined, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      setSucesso(true);
      setEstrelas(0);
      setComentario("");
    });
  }

  const notaExibida = hover || estrelas;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="estrelas" value={estrelas} />
      {empresaId && <input type="hidden" name="empresa_id" value={empresaId} />}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Sua nota</label>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEstrelas(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              className="p-0.5"
            >
              <Star
                className={n <= notaExibida ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                size={28}
                strokeWidth={1.5}
              />
            </button>
          ))}
          {notaExibida > 0 && (
            <span className="ml-2 text-sm font-medium text-slate-600">{rotuloNota(notaExibida)}</span>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Observações <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <textarea
          name="comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={4}
          className="input"
          placeholder="Conte pra gente o que está funcionando bem ou o que podemos melhorar."
        />
      </div>

      {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {sucesso && (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Avaliação enviada. Obrigado pelo retorno!
        </div>
      )}

      <button type="submit" disabled={isPending || estrelas === 0} className="btn-primary">
        {isPending ? "Enviando..." : "Enviar avaliação"}
      </button>
    </form>
  );
}
