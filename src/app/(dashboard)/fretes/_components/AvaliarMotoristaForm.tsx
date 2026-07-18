"use client";

import { useState, useTransition } from "react";
import { avaliarMotoristaAcao } from "../actions";

// Fase Destaques-Automaticos — mesma lista permitida pela constraint
// fretes_avaliacoes_tags_validas no banco. Quando uma tag se repete em 2+
// avaliações diferentes de um motorista, ela vira um selo no cartão de
// reputação (ver CartaoReputacaoMotorista).
const TAGS_DISPONIVEIS = ["Pontual", "Cuidado com a carga", "Comunicativo", "Educado", "Recomendo"];

export function AvaliarMotoristaForm({ freteId, empresaId }: { freteId: string; empresaId: string }) {
  const [estrelas, setEstrelas] = useState(5);
  const [comentario, setComentario] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function alternarTag(tag: string) {
    setTags((atual) => (atual.includes(tag) ? atual.filter((t) => t !== tag) : [...atual, tag]));
  }

  function enviar() {
    setErro(undefined);
    startTransition(async () => {
      const resultado = await avaliarMotoristaAcao(freteId, empresaId, estrelas, comentario.trim() || null, tags);
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
      <div className="flex flex-wrap gap-1.5">
        {TAGS_DISPONIVEIS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => alternarTag(tag)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              tags.includes(tag)
                ? "border-frota-500 bg-frota-100 text-frota-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tag}
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
