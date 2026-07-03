"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { comentarAcao, enviarAnexoAcao } from "../actions";
import { formatarTamanho, TAMANHO_MAX_ANEXO_BYTES, type AutorTipo } from "@/lib/chamados";

type Comentario = { id: string; autor_email: string; autor_tipo: string; texto: string; criado_em: string };
type Anexo = {
  id: string;
  nome: string;
  tamanho: number | null;
  autor_email: string | null;
  criado_em: string | null;
  urlAssinada: string | null;
};

// Thread de mensagens do chamado (usuário do cliente ↔ admin da FNI) +
// anexos — visual de chat, com as mensagens do papel atual alinhadas à
// direita (mesma convenção do Assistente FNI). Cada comentário novo, ou
// anexo novo, marca o chamado como "atualizado" (trigger no banco / código
// da action), disparando a notificação visual pro outro lado.
export function ThreadChamado({
  ticketId,
  comentarios,
  anexos,
  papel,
}: {
  ticketId: string;
  comentarios: Comentario[];
  anexos: Anexo[];
  papel: AutorTipo;
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [erroAnexo, setErroAnexo] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [pendingAnexo, startTransitionAnexo] = useTransition();
  const formAnexoRef = useRef<HTMLFormElement>(null);

  function enviarComentario(e: FormEvent) {
    e.preventDefault();
    const textoLimpo = texto.trim();
    if (!textoLimpo) return;
    setErro(undefined);
    startTransition(async () => {
      const resultado = await comentarAcao(ticketId, textoLimpo);
      if (resultado?.erro) setErro(resultado.erro);
      else setTexto("");
    });
  }

  function enviarAnexo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroAnexo(undefined);
    const formData = new FormData(e.currentTarget);

    // Fase 27.22 — mesmo raciocínio do ChamadoForm: valida o tamanho antes
    // de enviar, pra não deixar a Server Action falhar no nível de rede (o
    // que derrubaria a página com um erro genérico) e envolve a chamada em
    // try/catch como defesa extra caso mesmo assim algo escape.
    const arquivo = formData.get("arquivo");
    if (arquivo instanceof File && arquivo.size > TAMANHO_MAX_ANEXO_BYTES) {
      setErroAnexo(`O anexo (${formatarTamanho(arquivo.size)}) passa do limite de ${formatarTamanho(TAMANHO_MAX_ANEXO_BYTES)}. Envie um arquivo menor.`);
      return;
    }

    startTransitionAnexo(async () => {
      try {
        // Fase 27.27 — ticketId agora vai embutido no próprio formData (ver
        // input hidden "ticket_id" no form abaixo), a action passou a
        // receber um único argumento — mesmo padrão que já funciona em
        // criarChamadoAcao.
        const resultado = await enviarAnexoAcao(formData);
        if (resultado?.erro) setErroAnexo(resultado.erro);
        else formAnexoRef.current?.reset();
      } catch (e) {
        // Fase 27.24/27.25 — mostra o motivo real (e o "digest", quando o
        // Next mascara a mensagem em produção) em vez de um texto genérico,
        // pra dar pra diagnosticar sem precisar de acesso ao console do
        // navegador na próxima vez que isso acontecer.
        const motivo = e instanceof Error ? e.message : "erro desconhecido";
        const digest = (e as { digest?: string })?.digest;
        setErroAnexo(
          `Não foi possível enviar o anexo (${motivo}${digest ? ` — código ${digest}` : ""}). Tente novamente.`
        );
        console.error("[ThreadChamado] falha ao enviar anexo:", e);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">💬 Mensagens</h2>
        <div className="card space-y-3 p-4">
          {comentarios.length === 0 && <p className="text-sm text-slate-400">Nenhuma mensagem ainda.</p>}
          {comentarios.map((c) => {
            const proprio = c.autor_tipo === papel;
            return (
              <div key={c.id} className={`flex ${proprio ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    proprio ? "bg-frota-500 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <p className={`mb-1 text-xs font-medium ${proprio ? "text-white/80" : "text-slate-500"}`}>
                    {c.autor_tipo === "admin" ? "Equipe FNI" : c.autor_email}
                  </p>
                  <p className="whitespace-pre-wrap">{c.texto}</p>
                  <p className={`mt-1 text-right text-[10px] ${proprio ? "text-white/70" : "text-slate-400"}`}>
                    {new Date(c.criado_em).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={enviarComentario} className="mt-3 flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva uma mensagem…"
            className="input"
            disabled={pending}
          />
          <button type="submit" className="btn-primary shrink-0" disabled={pending || !texto.trim()}>
            Enviar
          </button>
        </form>
        {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">📎 Anexos</h2>
        <div className="card p-4">
          {anexos.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum anexo.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {anexos.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    {a.urlAssinada ? (
                      <a href={a.urlAssinada} target="_blank" rel="noreferrer" className="font-medium text-frota-600 hover:underline">
                        {a.nome}
                      </a>
                    ) : (
                      <span className="text-slate-500">
                        {a.nome} <span className="text-xs italic text-slate-400">(anexo legado, indisponível para download)</span>
                      </span>
                    )}
                    <p className="text-xs text-slate-400">
                      {formatarTamanho(a.tamanho)}
                      {a.autor_email ? ` · enviado por ${a.autor_email}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form ref={formAnexoRef} onSubmit={enviarAnexo} className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <input type="hidden" name="ticket_id" value={ticketId} />
            <input type="file" name="arquivo" required className="input text-sm" disabled={pendingAnexo} />
            <button type="submit" className="btn-secondary shrink-0 text-sm" disabled={pendingAnexo}>
              {pendingAnexo ? "Enviando..." : "Enviar anexo"}
            </button>
          </form>
          {erroAnexo && <p className="mt-1 text-xs text-red-600">{erroAnexo}</p>}
        </div>
      </div>
    </div>
  );
}
