"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

// Ditado por voz (Web Speech API do navegador, em português do Brasil). É uma OPÇÃO ao lado
// do campo de texto: o usuário digita ou clica no microfone e fala. O texto falado entra no
// campo para ser conferido e enviado (não envia sozinho, para evitar pergunta mal entendida).
// O reconhecimento é feito pelo próprio navegador (Chrome/Edge/Safari); onde não existe, o botão
// nem aparece. Nada de áudio passa pelos servidores da FNI.
type ReconhecimentoVoz = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type ConstrutorVoz = new () => ReconhecimentoVoz;

function obterConstrutor(): ConstrutorVoz | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstrutorVoz; webkitSpeechRecognition?: ConstrutorVoz };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MENSAGENS_ERRO: Record<string, string> = {
  "not-allowed": "Permita o uso do microfone no navegador para falar com o Assistente.",
  "service-not-allowed": "Permita o uso do microfone no navegador para falar com o Assistente.",
  "no-speech": "Não ouvi nada. Tente de novo, falando mais perto do microfone.",
  "audio-capture": "Nenhum microfone encontrado neste computador.",
  network: "O reconhecimento de voz precisa de internet. Tente novamente.",
};

export function BotaoVoz({
  textoAtual,
  onTexto,
  disabled = false,
}: {
  /** Texto já digitado no campo: a fala é acrescentada depois dele. */
  textoAtual: string;
  onTexto: (texto: string) => void;
  disabled?: boolean;
}) {
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const recRef = useRef<ReconhecimentoVoz | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    setSuportado(obterConstrutor() !== null);
    return () => recRef.current?.stop();
  }, []);

  if (!suportado) return null;

  function alternar() {
    if (ouvindo) {
      recRef.current?.stop();
      return;
    }
    const Construtor = obterConstrutor();
    if (!Construtor) return;
    setErro(null);
    const rec = new Construtor();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    baseRef.current = textoAtual.trim();
    rec.onresult = (e) => {
      let falado = "";
      for (let i = e.resultIndex; i < e.results.length; i++) falado += e.results[i][0].transcript;
      onTexto([baseRef.current, falado.trim()].filter(Boolean).join(" "));
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") setErro(MENSAGENS_ERRO[e.error] ?? "Não foi possível usar o microfone agora.");
    };
    rec.onend = () => setOuvindo(false);
    recRef.current = rec;
    try {
      rec.start();
      setOuvindo(true);
    } catch {
      setOuvindo(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={alternar}
        disabled={disabled}
        aria-pressed={ouvindo}
        aria-label={ouvindo ? "Parar de ouvir" : "Falar a pergunta"}
        title={ouvindo ? "Parar de ouvir" : "Falar a pergunta (microfone)"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-slate-600 disabled:opacity-40 dark:text-slate-300 ${
          ouvindo ? "animate-pulse border-red-400 bg-red-50 text-red-600 dark:bg-red-950/40" : "border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
        }`}
      >
        {ouvindo ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
      </button>
      {erro && (
        <span role="alert" className="basis-full text-xs text-red-600">
          {erro}
        </span>
      )}
    </>
  );
}
