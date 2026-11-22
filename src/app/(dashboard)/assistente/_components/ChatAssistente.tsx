"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { perguntarAssistenteAcao, confirmarRegraConsumoAcao } from "../actions";
import type { MensagemChat } from "@/lib/assistenteIA";
import type { ConsultaExecutada, BlocoVisual, PropostaAcao } from "@/lib/assistenteIA";
import { BlocoVisualAssistente } from "./BlocoVisualAssistente";
import BotaoBaixarPdfAssistenteLazy from "./BotaoBaixarPdfAssistenteLazy";

type MensagemExibida = MensagemChat & { consultas?: ConsultaExecutada[]; blocos?: BlocoVisual[]; propostas?: PropostaAcao[]; erro?: boolean };
type EstadoProposta = { estado: "pendente" | "salvando" | "confirmada" | "cancelada"; mensagem?: string };

const PERGUNTAS_SUGERIDAS = [
  "Qual o melhor posto para abastecer Diesel S-10 entre Curitiba e São Paulo?",
  "Qual a previsão de custo com combustível da minha frota até o fim do mês?",
  "Mostre em gráfico o custo de combustível por mês nos últimos 6 meses",
  "Quais os 10 veículos que mais gastaram com combustível este ano? (gráfico)",
  "Distribuição do gasto por tipo de combustível, em pizza",
  "Gasto por meio de pagamento (PróFrotas, PDV, outros) nos últimos 90 dias",
  "Quanto gastamos com combustível nos últimos 30 dias?",
  "Quais os 5 veículos com maior custo de manutenção este ano?",
  "Quantos motoristas ativos temos por centro de custo?",
  "Quais multas estão em aberto e quanto somam? Mostre por motorista",
  "Parametrize os veículos da Fiat com consumo médio entre 9 e 12 km/l para autorizar o abastecimento",
  "Fretes por status neste ano, em gráfico",
  "Quais peças estão com estoque abaixo do mínimo?",
  "Qual veículo está sem manutenção registrada há mais tempo?",
  "Como funciona a integração com o Pró-Frotas?",
  "O que preciso configurar pra abastecimentos aparecerem certo nos indicadores?",
];

// Chat do Assistente FNI: mantém o histórico só em memória (sem persistir no
// banco por enquanto — se o usuário atualizar a página, a conversa reinicia).
// Cada pergunta chama a server action perguntarAssistenteAcao, que por trás
// aciona o Claude com a ferramenta de SQL somente leitura (ia_executar_select),
// sempre executando com a permissão do usuário logado (RLS).
export function ChatAssistente({ usuarioEmail, empresaId }: { usuarioEmail?: string; empresaId?: string | null }) {
  const [mensagens, setMensagens] = useState<MensagemExibida[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [pending, startTransition] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);
  const [estadoPropostas, setEstadoPropostas] = useState<Record<string, EstadoProposta>>({});

  async function decidirProposta(chave: string, p: PropostaAcao, confirmar: boolean) {
    if (!confirmar) {
      setEstadoPropostas((prev) => ({ ...prev, [chave]: { estado: "cancelada" } }));
      return;
    }
    setEstadoPropostas((prev) => ({ ...prev, [chave]: { estado: "salvando" } }));
    const r = await confirmarRegraConsumoAcao(p);
    setEstadoPropostas((prev) => ({
      ...prev,
      [chave]: r.ok ? { estado: "confirmada", mensagem: r.mensagem } : { estado: "pendente", mensagem: r.erro },
    }));
  }

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
      const resultado = await perguntarAssistenteAcao(perguntaLimpa, historicoParaEnvio, empresaId ?? undefined);
      if ("erro" in resultado) {
        setMensagens((prev) => [...prev, { role: "assistant", content: resultado.erro, erro: true }]);
      } else {
        setMensagens((prev) => [
          ...prev,
          { role: "assistant", content: resultado.resposta, consultas: resultado.consultas, blocos: resultado.blocos, propostas: resultado.propostas },
        ]);
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col card">
      {mensagens.length > 0 && (
        <div className="flex justify-end border-b border-slate-200 dark:border-slate-700 p-2">
          <BotaoBaixarPdfAssistenteLazy
            mensagens={mensagens.map((m) => ({ role: m.role, content: m.content, consultas: m.consultas }))}
            usuarioEmail={usuarioEmail}
          />
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {mensagens.length === 0 && (
          <div>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Pergunte sobre abastecimentos, custos, veículos, motoristas, manutenção ou centros de custo da sua
              operação — ou sobre como usar qualquer tela da plataforma (integrações, roteirização, assinatura
              etc.). Exemplos:
            </p>
            <div className="flex flex-wrap gap-2">
              {PERGUNTAS_SUGERIDAS.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => enviar(sugestao)}
                  className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 transition hover:bg-slate-100"
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
              className={`${(m.blocos && m.blocos.length > 0) || (m.propostas && m.propostas.length > 0) ? "w-full max-w-[92%]" : "max-w-[80%]"} rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-frota-500 text-white"
                  : m.erro
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              }`}
            >
              {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
              {m.blocos?.map((b, k) => (
                <BlocoVisualAssistente key={k} bloco={b} />
              ))}
              {m.propostas?.map((p, k) => {
                const chave = `${i}-${k}`;
                const est = estadoPropostas[chave] ?? { estado: "pendente" as const };
                return (
                  <div key={chave} className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-slate-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-slate-100">
                    <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">Confirmação necessária</p>
                    <p className="mt-1 text-sm">{p.resumo}</p>
                    <p className="mt-1 text-xs opacity-80">
                      Empresa: {p.empresaNome || "—"}
                      {p.veiculosAfetados != null ? ` · alcança ${p.veiculosAfetados} veículo(s) cadastrado(s)` : ""}
                    </p>
                    {est.estado === "confirmada" ? (
                      <p className="mt-2 text-sm font-medium text-green-700 dark:text-green-300">✓ {est.mensagem}</p>
                    ) : est.estado === "cancelada" ? (
                      <p className="mt-2 text-sm text-slate-500">Cancelada — nada foi gravado.</p>
                    ) : (
                      <>
                        {est.mensagem && <p className="mt-2 text-xs text-red-600">{est.mensagem}</p>}
                        <div className="mt-2 flex gap-2">
                          <button type="button" className="btn-primary" disabled={est.estado === "salvando"} onClick={() => decidirProposta(chave, p, true)}>
                            {est.estado === "salvando" ? "Salvando…" : "Confirmar e criar regra"}
                          </button>
                          <button type="button" className="btn-secondary" disabled={est.estado === "salvando"} onClick={() => decidirProposta(chave, p, false)}>
                            Cancelar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
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
            <div className="max-w-[80%] rounded-2xl bg-slate-100 dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
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
        className="flex gap-2 border-t border-slate-200 dark:border-slate-700 p-3"
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
