"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { perguntarAssistenteAcao } from "../actions";
import type { MensagemChat } from "@/lib/assistenteIA";
import type { ConsultaExecutada } from "@/lib/assistenteIA";
import BotaoBaixarPdfAssistenteLazy from "./BotaoBaixarPdfAssistenteLazy";

type MensagemExibida = MensagemChat & { consultas?: ConsultaExecutada[]; erro?: boolean };

const PERGUNTAS_SUGERIDAS = [
  "Quanto gastamos com combustível nos últimos 30 dias?",
  "Quais os 5 veículos com maior custo de manutenção este ano?",
  "Quantos motoristas ativos temos por centro de custo?",
  "Qual veículo está sem manutenção registrada há mais tempo?",
];

// Chat do Assistente FNI: mantém o histórico só em memória (sem persistir no
// banco por enquanto — se o usuário atualizar a página, a conversa reinicia).
// Cada pergunta chama a server action perguntarAssistenteAcao, que por trás
// aciona o Claude com a ferramenta de SQL somente leitura (ia_executar_select),
// sempre executando com a permissão do usuário logado (RLS).
export function ChatAssistente({ usuarioEmail }: { usuarioEmail?: string }) {
  const [mensagens, setMensagens] = useState<MensagemExibida[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [pending, startTransition] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, pending]);

  function enviar(texto: string) {
    const perguntaLimpa = texto.trim();
    if (!perguntaLimpa || pending) return;

    const historicoParaEnvio: MensagemChat[] = mensagens.map((m) => ({ role: m.role, content: m.content }));
    const novasMensagens: MensagemExibida[] = [...mensagens, { role: "user", content: perguntaLimpa }];
    setMensagens(novasMensagens);
    setPergunta("");

    startTransition(async () => {
      const resultado = await perguntarAssistenteAcao(perguntaLimpa, historicoParaEnvio);
      if ("erro" in resultado) {
        setMensagens((prev) => [...prev, { role: "assistant", content: resultado.erro, erro: true }]);
      } else {
        setMensagens((prev) => [
          ...prev,
          { role: "assistant", content: resultado.resposta, consultas: resultado.consultas },
        ]);
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col card">
      {mensagens.length > 0 && (
        <div className="flex justify-end border-b border-slate-200 p-2">
          <BotaoBaixarPdfAssistenteLazy
            mensagens={mensagens.map((m) => ({ role: m.role, content: m.content, consultas: m.consultas }))}
            usuarioEmail={usuarioEmail}
          />
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {mensagens.length === 0 && (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Pergunte sobre abastecimentos, custos, veículos, motoristas, manutenção ou centros de custo da sua
              operação. Exemplos:
            </p>
            <div className="flex flex-wrap gap-2">
              {PERGUNTAS_SUGERIDAS.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => enviar(sugestao)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-frota-500 text-white"
                  : m.erro
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.consultas && m.consultas.length > 0 && (
                <details className="mt-2 text-xs opacity-70">
                  <summary className="cursor-pointer select-none">
                    {m.consultas.length} consulta{m.consultas.length > 1 ? "s" : ""} ao banco
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {m.consultas.map((c, j) => (
                      <li key={j} className="rounded bg-black/5 p-1.5 font-mono">
                        {c.erro ? `Erro: ${c.erro}` : `${c.linhas} linha(s)`} — <code>{c.sql}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
              Consultando os dados da sua operação…
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(pergunta);
        }}
        className="flex gap-2 border-t border-slate-200 p-3"
      >
        <input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Pergunte algo sobre sua frota…"
          className="input"
          disabled={pending}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={pending || !pergunta.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
