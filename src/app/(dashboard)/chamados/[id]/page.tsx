import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { resolverPapelAtual } from "../actions";
import { BUCKET_ANEXOS, CORES_PRIORIDADE, CORES_STATUS, prioridadeLabel, statusLabel, tipoLabel, type TicketPrioridade, type TicketStatus, type TicketTipo } from "@/lib/chamados";
import { ThreadChamado } from "../_components/ThreadChamado";
import { ControlesAdminChamado } from "../_components/ControlesAdminChamado";
import { BotaoResolverChamado } from "../_components/BotaoResolverChamado";
import { BotaoVoltar } from "../../_components/BotaoVoltar";
import { logger } from "@/lib/logger";

// Fase 27.28 — achado real (em investigação): o crash mascarado e recorrente
// ao enviar anexo numa resposta de chamado (visto de novo mesmo após alinhar
// a assinatura da action na Fase 27.27) nunca apareceu em NENHUM log do
// Supabase (storage/auth/postgres), o que indica que o erro provavelmente
// não acontece dentro da própria Server Action, e sim durante o
// RE-RENDER desta página que o Next dispara automaticamente como parte da
// resposta de qualquer Server Action (sempre que cookies de sessão são
// atualizados, o Next re-renderiza a rota atual pra devolver um payload
// atualizado). Essa página tinha uma ESCRITA no banco (marcar como "visto")
// direto no corpo do Server Component, e um loop de createSignedUrl sem
// proteção — ambos agora blindados com try/catch (não derrubam a tela por
// si só), e a função inteira ganhou uma camada de diagnóstico igual à da
// Fase 27.26: se ainda assim quebrar, mostra o erro real na tela em vez do
// genérico mascarado, pra finalmente identificar a causa raiz.
export default async function ChamadoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ anexoErro?: string }>;
}) {
  try {
    const { id } = await params;
    const { anexoErro } = await searchParams;
    const supabase = await createClient();

    const { data: ticket } = await supabase.from("tickets").select("*, empresas(nome)").eq("id", id).maybeSingle();
    if (!ticket) notFound();

    const { papel } = await resolverPapelAtual(supabase);

    // Marca como "visto" pelo papel atual assim que a página é aberta — base
    // da notificação visual na listagem (comparação com atualizado_em).
    // Isolado em try/catch: é só uma notificação visual, best-effort, não
    // pode derrubar a tela.
    try {
      const agoraVisto = new Date().toISOString();
      if (papel === "admin") {
        await supabase.from("tickets").update({ admin_visto_em: agoraVisto }).eq("id", id);
      } else {
        await supabase.from("tickets").update({ usuario_visto_em: agoraVisto }).eq("id", id);
      }
    } catch (e) {
      void logger.error("chamados/[id]", "Falha ao marcar como visto (ignorado)", e);
    }

    const [{ data: comentarios }, { data: anexos }] = await Promise.all([
      supabase.from("ticket_comentarios").select("*").eq("ticket_id", id).order("criado_em", { ascending: true }),
      supabase.from("ticket_anexos").select("*").eq("ticket_id", id).order("criado_em", { ascending: true }),
    ]);

    const anexosComUrl = await Promise.all(
      (anexos ?? []).map(async (a) => {
        if (!a.url) return { ...a, urlAssinada: null as string | null };
        try {
          const { data } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(a.url, 3600);
          return { ...a, urlAssinada: data?.signedUrl ?? null };
        } catch (e) {
          // Um anexo com objeto ausente/corrompido no Storage não pode
          // derrubar a tela inteira nem os outros anexos válidos.
          void logger.error("chamados/[id]", "Falha ao assinar URL de anexo (ignorado)", e);
          return { ...a, urlAssinada: null as string | null };
        }
      })
    );

    const corStatus = CORES_STATUS[ticket.status as TicketStatus] ?? CORES_STATUS.aberto;
    const corPrioridade = CORES_PRIORIDADE[(ticket.prioridade as TicketPrioridade) ?? "media"] ?? CORES_PRIORIDADE.media;

    return (
      <div>
        <BotaoVoltar href="/chamados" label="Voltar para Chamados" />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              #{ticket.numero} — {ticket.titulo}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {ticket.empresas?.nome ? `${ticket.empresas.nome} · ` : ""}
              {tipoLabel(ticket.tipo as TicketTipo)} · aberto por {ticket.user_email} em {formatDate(ticket.criado_em)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-sm ${corStatus.bg} ${corStatus.text} ${corStatus.border}`}>
              {statusLabel(ticket.status as TicketStatus)}
            </span>
            <span className={`rounded-full border px-3 py-1 text-sm ${corPrioridade.bg} ${corPrioridade.text} ${corPrioridade.border}`}>
              {prioridadeLabel((ticket.prioridade as TicketPrioridade) ?? "media")}
            </span>
          </div>
        </div>

        {papel === "admin" ? (
          <ControlesAdminChamado ticketId={ticket.id} statusAtual={ticket.status as TicketStatus} prioridadeAtual={(ticket.prioridade as TicketPrioridade) ?? "media"} />
        ) : (
          ticket.status !== "resolvido" &&
          ticket.status !== "fechado" && <BotaoResolverChamado ticketId={ticket.id} />
        )}

        <div className="my-6 card p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Descrição</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.descricao}</p>
        </div>

        {anexoErro === "1" && (
          <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            O chamado foi aberto normalmente, mas o anexo enviado junto não pôde ser salvo. Você pode tentar
            anexá-lo de novo logo abaixo.
          </p>
        )}

        {ticket.resposta_admin && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-500">Resposta oficial (histórico)</p>
            <p className="whitespace-pre-wrap text-sm text-indigo-800">{ticket.resposta_admin}</p>
          </div>
        )}

        <ThreadChamado ticketId={ticket.id} comentarios={comentarios ?? []} anexos={anexosComUrl} papel={papel} />
      </div>
    );
  } catch (e) {
    // Deixa o notFound() (que lança internamente) passar direto, senão a
    // página de "não encontrado" vira uma tela de erro genérico.
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") throw e;

    const mensagem = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    void logger.error("chamados/[id]", "Falha ao carregar a tela", e);
    return (
      <div>
        <BotaoVoltar href="/chamados" label="Voltar para Chamados" />
        <h1 className="mb-6 mt-2 text-xl font-semibold text-slate-900">Chamado</h1>
        <div className="max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Não foi possível carregar esta tela.</p>
          <p className="mt-1">Motivo: {mensagem}</p>
          {stack && (
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-red-700">
              {stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
