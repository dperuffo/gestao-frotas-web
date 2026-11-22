"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowUp } from "lucide-react";
import { caminhoAssistenteComPergunta } from "@/lib/assistenteTemas";

// Cartão de destaque no Dashboard: o usuário pergunta direto e cai no Assistente
// FNI com a resposta já a caminho.
export function CampoPerguntaFni({ sugestoes, empresaId }: { sugestoes: string[]; empresaId?: string | null }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");

  function perguntar(q: string) {
    const limpa = q.trim();
    if (limpa) router.push(caminhoAssistenteComPergunta(limpa, empresaId));
  }

  return (
    <div className="card mb-6 border-accento/40 bg-accento/5 p-4 dark:bg-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accento" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pergunte à FNI</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">Seu assistente para consultas, gráficos e regras</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          perguntar(texto);
        }}
        className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-accento dark:border-slate-600 dark:bg-slate-900"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: qual a previsão de gasto com combustível até o fim do mês?"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          aria-label="Pergunta para o Assistente FNI"
        />
        <button type="submit" disabled={!texto.trim()} aria-label="Enviar pergunta" className="flex h-8 w-8 items-center justify-center rounded-full bg-accento text-white disabled:opacity-40">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {sugestoes.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => perguntar(s)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-frota-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
