import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { resolverPapelAtual } from "../actions";
import { BUCKET_ANEXOS, CORES_PRIORIDADE, CORES_STATUS, prioridadeLabel, statusLabel, tipoLabel, type TicketPrioridade, type TicketStatus, type TicketTipo } from "@/lib/chamados";
import { ThreadChamado } from "../_components/ThreadChamado";
import { ControlesAdminChamado } from "../_components/ControlesAdminChamado";
import { BotaoResolverChamado } from "../_components/BotaoResolverChamado";

export default async function ChamadoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ anexoErro?: string }>;
}) {
  const { id } = await params;
  const { anexoErro } = await searchParams;
  const supabase = await createClient();

  const { data: ticket } = await supabase.from("tickets").select("*, empresas(nome)").eq("id", id).maybeSingle();
  if (!ticket) notFound();

  const { papel } = await resolverPapelAtual(supabase);

  // Marca como "visto" pelo papel atual assim que a página é aberta — base
  // da notificação visual na listagem (comparação com atualizado_em).
  const agoraVisto = new Date().toISOString();
  if (papel === "admin") {
    await supabase.from("tickets").update({ admin_visto_em: agoraVisto }).eq("id", id);
  } else {
    await supabase.from("tickets").update({ usuario_visto_em: agoraVisto }).eq("id", id);
  }

  const [{ data: comentarios }, { data: anexos }] = await Promise.all([
    supabase.from("ticket_comentarios").select("*").eq("ticket_id", id).order("criado_em", { ascending: true }),
    supabase.from("ticket_anexos").select("*").eq("ticket_id", id).order("criado_em", { ascending: true }),
  ]);

  const anexosComUrl = await Promise.all(
    (anexos ?? []).map(async (a) => {
      if (!a.url) return { ...a, urlAssinada: null as string | null };
      const { data } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(a.url, 3600);
      return { ...a, urlAssinada: data?.signedUrl ?? null };
    })
  );

  const corStatus = CORES_STATUS[ticket.status as TicketStatus] ?? CORES_STATUS.aberto;
  const corPrioridade = CORES_PRIORIDADE[(ticket.prioridade as TicketPrioridade) ?? "media"] ?? CORES_PRIORIDADE.media;

  return (
    <div>
      <Link href="/chamados" className="mb-2 inline-block text-xs text-slate-500 hover:underline">
        ← Voltar para Chamados
      </Link>

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
}
