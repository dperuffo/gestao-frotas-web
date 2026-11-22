"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, ArrowUp, X } from "lucide-react";
import { BotaoVoz } from "./BotaoVoz";
import { caminhoAssistenteComPergunta, sugestaoParaTela, TEMAS_ASSISTENTE } from "@/lib/assistenteTemas";

// Acesso rápido ao Assistente FNI em qualquer tela: botão flutuante + atalho
// Ctrl/Cmd+K. A pergunta abre /assistente já enviada (sem duplicar o chat aqui).
export function AssistenteAtalhos() {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
      } else if (e.key === "Escape") {
        setAberto(false);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 30);
  }, [aberto]);

  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  if (pathname.startsWith("/assistente")) return null;

  const sugestao = sugestaoParaTela(pathname);

  function perguntar(q: string) {
    const limpa = q.trim();
    if (!limpa) return;
    setAberto(false);
    setTexto("");
    // Leva o cliente junto: o da tela atual (?empresa=) ou, se não houver, o último da sessão
    // (o mesmo exibido como "Último: ..." no menu). Sem isso o Assistente pedia o cliente de novo.
    let empresaId: string | null = null;
    try {
      empresaId =
        new URLSearchParams(window.location.search).get("empresa") ??
        window.sessionStorage.getItem("fni:cliente-atual");
    } catch {
      empresaId = null;
    }
    router.push(caminhoAssistenteComPergunta(limpa, empresaId));
  }

  return (
    <>
      {!aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir o Assistente FNI (Ctrl K)"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-accento px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-accento-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-accento/40"
        >
          <Sparkles className="h-5 w-5" aria-hidden />
          <span className="hidden sm:inline">Pergunte à FNI</span>
        </button>
      )}

      {aberto && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center bg-slate-900/50 p-4 pt-[12vh]" onClick={() => setAberto(false)}>
          <div
            role="dialog"
            aria-label="Assistente FNI"
            className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accento" aria-hidden />
              <p className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">Assistente FNI</p>
              <span className="hidden rounded border border-slate-200 px-1.5 text-[11px] text-slate-500 sm:inline dark:border-slate-600">Ctrl K</span>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perguntar(texto);
              }}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 focus-within:border-frota-500 dark:border-slate-600"
            >
              <input
                ref={inputRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Pergunte algo sobre sua frota…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                aria-label="Pergunta para o Assistente FNI"
              />
              <BotaoVoz textoAtual={texto} onTexto={setTexto} onEnviar={perguntar} />
              <button type="submit" disabled={!texto.trim()} aria-label="Enviar" className="flex h-7 w-7 items-center justify-center rounded-full bg-accento text-white disabled:opacity-40">
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
            <p className="mb-1 mt-3 text-xs text-slate-500 dark:text-slate-400">Sugestão para esta tela</p>
            <button type="button" onClick={() => perguntar(sugestao)} className="w-full rounded-lg bg-frota-50 px-3 py-2 text-left text-sm text-frota-800 hover:bg-frota-100 dark:bg-slate-700 dark:text-slate-100">
              {sugestao}
            </button>
            <p className="mb-1 mt-3 text-xs text-slate-500 dark:text-slate-400">Mais ideias</p>
            <div className="flex flex-wrap gap-2">
              {TEMAS_ASSISTENTE.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => perguntar(t.perguntas[0])}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {t.titulo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
