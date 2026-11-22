"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Coins,
  Route as RouteIcon,
  Car,
  SettingsIcon,
  FileText,
  HelpCircle,
  Sparkles,
  ArrowUp,
  Plus,
  History,
  Copy,
  Check,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  perguntarAssistenteAcao,
  confirmarRegraConsumoAcao,
  salvarConversaAcao,
  listarConversasAcao,
  abrirConversaAcao,
  excluirConversaAcao,
  type ResumoConversa,
  type MensagemSalva,
} from "../actions";
import type { MensagemChat, ConsultaExecutada, BlocoVisual, PropostaAcao } from "@/lib/assistenteIA";
import { TEMAS_ASSISTENTE, CONTINUACOES_ASSISTENTE } from "@/lib/assistenteTemas";
import BotaoBaixarPdfAssistenteLazy from "./BotaoBaixarPdfAssistenteLazy";
import { BlocoVisualAssistente } from "./BlocoVisualAssistente";
import { TextoMarkdown } from "./TextoMarkdown";
import { SeletorClienteAssistente } from "./SeletorClienteAssistente";

type MensagemExibida = MensagemChat & { consultas?: ConsultaExecutada[]; blocos?: BlocoVisual[]; propostas?: PropostaAcao[]; erro?: boolean };
type EstadoProposta = { estado: "pendente" | "salvando" | "confirmada" | "cancelada"; mensagem?: string };

const ICONE_TEMA: Record<string, LucideIcon> = {
  custos: Coins,
  rotas: RouteIcon,
  veiculos: Car,
  regras: SettingsIcon,
  operacao: FileText,
  ajuda: HelpCircle,
};

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Tela do Assistente FNI: início com caixa em destaque + cartões por tema; depois
// conversa com respostas em cartão (gráficos, tabelas, confirmações), ações rápidas,
// sugestões de continuação e histórico de conversas por usuário.
export function ChatAssistente({
  usuarioEmail,
  primeiroNome,
  empresaId,
  empresas,
  perguntaInicial,
}: {
  usuarioEmail?: string;
  primeiroNome?: string;
  empresaId?: string | null;
  empresas: { id: string; nome: string }[];
  perguntaInicial?: string;
}) {
  const router = useRouter();
  const [mensagens, setMensagens] = useState<MensagemExibida[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [pending, startTransition] = useTransition();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [conversas, setConversas] = useState<ResumoConversa[]>([]);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [estadoPropostas, setEstadoPropostas] = useState<Record<string, EstadoProposta>>({});
  const fimRef = useRef<HTMLDivElement>(null);
  const enviouInicial = useRef(false);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, pending]);

  // Pergunta vinda do botão flutuante / Ctrl+K / Dashboard: envia uma única vez e limpa a URL.
  useEffect(() => {
    if (!perguntaInicial || enviouInicial.current) return;
    enviouInicial.current = true;
    enviar(perguntaInicial);
    router.replace(empresaId ? `/assistente?empresa=${empresaId}` : "/assistente");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviar(texto: string) {
    const perguntaLimpa = texto.trim();
    if (!perguntaLimpa || pending) return;

    const historicoParaEnvio: MensagemChat[] = mensagens.map((m) => ({ role: m.role, content: m.content }));
    const novasMensagens: MensagemExibida[] = [...mensagens, { role: "user", content: perguntaLimpa }];
    setMensagens(novasMensagens);
    setPergunta("");

    startTransition(async () => {
      const resultado = await perguntarAssistenteAcao(perguntaLimpa, historicoParaEnvio, empresaId ?? undefined);
      const resposta: MensagemExibida =
        "erro" in resultado
          ? { role: "assistant", content: resultado.erro, erro: true }
          : { role: "assistant", content: resultado.resposta, consultas: resultado.consultas, blocos: resultado.blocos, propostas: resultado.propostas };
      const todas = [...novasMensagens, resposta];
      setMensagens(todas);
      const salvo = await salvarConversaAcao({
        id: conversaId,
        empresaId,
        mensagens: todas as MensagemSalva[],
      });
      if ("id" in salvo) setConversaId(salvo.id);
    });
  }

  function novaConversa() {
    setMensagens([]);
    setConversaId(null);
    setEstadoPropostas({});
    setHistoricoAberto(false);
  }

  async function alternarHistorico() {
    const abrir = !historicoAberto;
    setHistoricoAberto(abrir);
    if (abrir) setConversas(await listarConversasAcao());
  }

  async function abrirConversa(id: string) {
    const r = await abrirConversaAcao(id);
    if ("erro" in r) return;
    setMensagens(r.mensagens as MensagemExibida[]);
    setConversaId(id);
    setEstadoPropostas({});
    setHistoricoAberto(false);
  }

  async function excluirConversa(id: string) {
    await excluirConversaAcao(id);
    setConversas((prev) => prev.filter((c) => c.id !== id));
    if (id === conversaId) novaConversa();
  }

  async function copiar(i: number, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(i);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      /* navegador sem permissão de área de transferência */
    }
  }

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

  const caixa = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar(pergunta);
      }}
      className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-accento dark:border-slate-600 dark:bg-slate-800"
    >
      <Sparkles className="h-5 w-5 shrink-0 text-accento" aria-hidden />
      <input
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value)}
        placeholder="Pergunte algo sobre sua frota…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        disabled={pending}
        aria-label="Pergunta para o Assistente FNI"
      />
      <button
        type="submit"
        disabled={pending || !pergunta.trim()}
        aria-label="Enviar pergunta"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accento text-white disabled:opacity-40"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </form>
  );

  const ultimaIdx = mensagens.length - 1;
  const mostrarContinuacoes =
    !pending && ultimaIdx >= 0 && mensagens[ultimaIdx].role === "assistant" && !mensagens[ultimaIdx].erro && !mensagens[ultimaIdx].propostas?.length;

  return (
    <div className="card flex h-[calc(100vh-190px)] min-h-[460px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        {empresas.length > 1 && <SeletorClienteAssistente empresas={empresas} empresaSelecionadaId={empresaId ?? null} compacto />}
        <span className="flex-1" />
        {mensagens.length > 0 && (
          <BotaoBaixarPdfAssistenteLazy
            mensagens={mensagens.map((m) => ({ role: m.role, content: m.content, consultas: m.consultas }))}
            usuarioEmail={usuarioEmail}
          />
        )}
        <button type="button" onClick={alternarHistorico} className="btn-secondary inline-flex items-center gap-1 text-sm">
          <History className="h-4 w-4" /> Histórico
        </button>
        <button type="button" onClick={novaConversa} className="btn-secondary inline-flex items-center gap-1 text-sm">
          <Plus className="h-4 w-4" /> Nova conversa
        </button>
      </div>

      {historicoAberto && (
        <div className="max-h-56 overflow-y-auto border-b border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
          {conversas.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">Suas conversas aparecem aqui depois da primeira pergunta.</p>
          ) : (
            <ul className="space-y-1">
              {conversas.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => abrirConversa(c.id)}
                    className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white dark:hover:bg-slate-700 ${c.id === conversaId ? "font-medium" : ""}`}
                  >
                    {c.titulo} <span className="ml-1 text-xs text-slate-400">{dataCurta(c.atualizadoEm)}</span>
                  </button>
                  <button type="button" onClick={() => excluirConversa(c.id)} aria-label="Excluir conversa" className="p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mensagens.length === 0 ? (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-xl font-semibold text-slate-900 dark:text-slate-100">
              {primeiroNome ? `Olá, ${primeiroNome}. ` : "Olá. "}O que você quer saber sobre a frota?
            </h2>
            <p className="mb-4 mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
              Pergunte, peça gráficos ou peça para cadastrar regras. Você confirma antes de qualquer alteração.
            </p>
            {caixa}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEMAS_ASSISTENTE.map((tema) => {
                const Icone = ICONE_TEMA[tema.id] ?? Sparkles;
                return (
                  <div key={tema.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                      <Icone className="h-4 w-4 text-accento" aria-hidden /> {tema.titulo}
                    </p>
                    <ul className="space-y-1">
                      {tema.perguntas.map((q) => (
                        <li key={q}>
                          <button
                            type="button"
                            onClick={() => enviar(q)}
                            className="w-full rounded-md px-2 py-1 text-left text-xs text-slate-600 hover:bg-frota-50 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            {q}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {mensagens.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`${(m.blocos && m.blocos.length > 0) || (m.propostas && m.propostas.length > 0) ? "w-full max-w-[92%]" : "max-w-[80%]"} rounded-2xl px-4 py-2.5 ${
                    m.role === "user"
                      ? "bg-frota-500 text-white"
                      : m.erro
                        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                  }`}
                >
                  {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : m.content && <TextoMarkdown texto={m.content} />}
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
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
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
                  {m.role === "assistant" && !m.erro && (m.content || m.consultas?.length) && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {m.content && (
                        <button type="button" onClick={() => copiar(i, m.content)} className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-100">
                          {copiado === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado === i ? "Copiado" : "Copiar"}
                        </button>
                      )}
                      {m.consultas && m.consultas.length > 0 && (
                        <details>
                          <summary className="cursor-pointer select-none">
                            Ver consultas ({m.consultas.length})
                          </summary>
                          <ul className="mt-1 space-y-1">
                            {m.consultas.map((c, j) => (
                              <li key={j} className="rounded bg-black/5 p-1.5 font-mono dark:bg-white/10">
                                {c.erro ? `Erro: ${c.erro}` : `${c.linhas} linha(s)`} — <code>{c.sql}</code>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  Consultando os dados da sua operação…
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-slate-700">
            {mostrarContinuacoes && (
              <div className="mb-2 flex flex-wrap gap-2">
                {CONTINUACOES_ASSISTENTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => enviar(c)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-frota-50 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {caixa}
          </div>
        </>
      )}
    </div>
  );
}
