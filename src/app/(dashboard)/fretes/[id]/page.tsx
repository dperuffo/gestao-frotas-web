import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PainelPropostas, type Proposta } from "../_components/PainelPropostas";
import { FormPostoRecomendado } from "../_components/FormPostoRecomendado";
import { RemoverPostoRecomendadoButton } from "../_components/RemoverPostoRecomendadoButton";
import { AvaliarMotoristaForm } from "../_components/AvaliarMotoristaForm";

type FreteDetalhe = {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  origem_label: string;
  destino_label: string;
  tipo_carga: string | null;
  peso_carga_kg: number | null;
  data_saida_prevista: string | null;
  prazo_entrega: string | null;
  km_estimado: number | null;
  valor_oferecido: number;
  motorista_id: string | null;
};

const LABEL_STATUS: Record<string, string> = {
  disponivel: "Disponível (mercado aberto)",
  aguardando_confirmacao: "Aguardando confirmação do motorista",
  aceito: "Aceito",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  recusado: "Recusado pelo motorista",
};

export default async function FreteDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { data: frete } = await supabase
    .from("fretes")
    .select(
      "id, empresa_id, titulo, descricao, status, origem_label, destino_label, tipo_carga, peso_carga_kg, data_saida_prevista, prazo_entrega, km_estimado, valor_oferecido, motorista_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!frete) {
    return <p className="p-4 text-sm text-slate-500">Frete não encontrado.</p>;
  }

  const freteTipado = frete as FreteDetalhe;
  const empresaId = empresaParam ?? freteTipado.empresa_id;

  const { data: propostas } = await supabase.rpc("negociacoes_frete_empresa", { p_frete_id: id });

  const emAndamentoOuConcluido = ["aceito", "em_andamento", "concluido"].includes(freteTipado.status);

  const [{ data: postos }, { data: eventos }, { data: itensParceria }, { data: avaliacoes }] = await Promise.all([
    supabase
      .from("fretes_postos_recomendados")
      .select("id, nome_posto, observacao, item_catalogo_id, criado_em")
      .eq("frete_id", id)
      .order("ordem"),
    supabase
      .from("fretes_eventos")
      .select("id, tipo_evento, observacao, criado_em, foto_path")
      .eq("frete_id", id)
      .order("criado_em"),
    supabase
      .from("fidelidade_catalogo_itens")
      .select("id, titulo, parceiro_nome")
      .eq("categoria", "conveniencia_posto")
      .eq("ativo", true),
    supabase.from("fretes_avaliacoes").select("avaliador, estrelas, comentario").eq("frete_id", id),
  ]);

  // Fase foto-evidência-checkpoints — bucket `fretes-evidencias` é privado,
  // então geramos uma signed URL por foto (válida 1h) só pra quem esta
  // página já provou (via RLS de storage) que pode ver: dono da empresa do
  // frete ou o próprio motorista. Foto ausente ou signed URL falhando não
  // pode derrubar a página — mesmo tratamento best-effort do resto do app.
  const eventosComFoto = await Promise.all(
    (eventos ?? []).map(async (e) => {
      if (!e.foto_path) return { ...e, fotoUrl: null as string | null };
      const { data } = await supabase.storage.from("fretes-evidencias").createSignedUrl(e.foto_path, 3600);
      return { ...e, fotoUrl: data?.signedUrl ?? null };
    })
  );

  const avaliacaoMotorista = (avaliacoes ?? []).find((a) => a.avaliador === "motorista");
  const avaliacaoCliente = (avaliacoes ?? []).find((a) => a.avaliador === "cliente");

  const LABEL_EVENTO: Record<string, string> = {
    saiu_origem: "Saiu da origem",
    chegou_posto: "Chegou no posto",
    abasteceu: "Abasteceu",
    parada: "Parada",
    chegou_destino: "Chegou no destino",
    ocorrencia: "Ocorrência",
    concluido: "Concluiu o frete",
  };

  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div>
      <Link href={`/fretes?empresa=${empresaId}`} className="mb-4 inline-block text-sm text-frota-600 hover:underline">
        ← Voltar pra Fretes
      </Link>

      <div className="card mb-6 p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{freteTipado.titulo}</h1>
          <span className="text-xs font-medium text-slate-500">{LABEL_STATUS[freteTipado.status] ?? freteTipado.status}</span>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          {freteTipado.origem_label} → {freteTipado.destino_label}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Valor</p>
            <p className="font-semibold text-slate-900">{formatoMoeda.format(freteTipado.valor_oferecido)}</p>
          </div>
          {freteTipado.km_estimado && (
            <div>
              <p className="text-xs uppercase text-slate-500">Km estimado</p>
              <p className="font-semibold text-slate-900">{freteTipado.km_estimado.toLocaleString("pt-BR")}</p>
            </div>
          )}
          {freteTipado.tipo_carga && (
            <div>
              <p className="text-xs uppercase text-slate-500">Carga</p>
              <p className="font-semibold text-slate-900">{freteTipado.tipo_carga}</p>
            </div>
          )}
          {freteTipado.peso_carga_kg && (
            <div>
              <p className="text-xs uppercase text-slate-500">Peso</p>
              <p className="font-semibold text-slate-900">{freteTipado.peso_carga_kg.toLocaleString("pt-BR")} kg</p>
            </div>
          )}
        </div>
        {freteTipado.descricao && <p className="mt-4 text-sm text-slate-600">{freteTipado.descricao}</p>}
      </div>

      {freteTipado.status === "aguardando_confirmacao" && (
        <p className="card mb-6 p-4 text-sm text-slate-600">
          Frete atribuído diretamente — aguardando o motorista aceitar ou recusar no app dele.
        </p>
      )}

      {(freteTipado.status === "disponivel" || (propostas ?? []).length > 0) && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Propostas recebidas</h2>
          <PainelPropostas
            empresaId={empresaId}
            propostas={(propostas ?? []) as unknown as Proposta[]}
            freteAberto={freteTipado.status === "disponivel"}
          />
        </div>
      )}

      {freteTipado.status !== "cancelado" && freteTipado.status !== "recusado" && (
        <div className="card mb-6 p-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">🛢️ Postos recomendados</h2>
          <p className="mb-3 text-xs text-slate-500">
            Sugira paradas de abastecimento no caminho — pode vincular a um benefício de Parcerias Locais daquele posto.
          </p>
          <div className="mb-3 space-y-2">
            {(postos ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{p.nome_posto}</span>
                  {p.item_catalogo_id && <span className="ml-2 text-xs text-frota-600">🎟️ com benefício vinculado</span>}
                  {p.observacao && <span className="ml-2 text-xs text-slate-500">{p.observacao}</span>}
                </div>
                <RemoverPostoRecomendadoButton id={p.id} freteId={id} empresaId={empresaId} />
              </div>
            ))}
            {(postos ?? []).length === 0 && <p className="text-sm text-slate-400">Nenhum posto recomendado ainda.</p>}
          </div>
          <FormPostoRecomendado freteId={id} empresaId={empresaId} itensParceria={itensParceria ?? []} />
        </div>
      )}

      {emAndamentoOuConcluido && (eventos ?? []).length > 0 && (
        <div className="card mb-6 p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">📍 Linha do tempo</h2>
          <div className="space-y-2 text-sm">
            {eventosComFoto.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2">
                <span className="flex items-center gap-2 text-slate-700">
                  {LABEL_EVENTO[e.tipo_evento] ?? e.tipo_evento}
                  {e.observacao && <span className="text-xs text-slate-500">— {e.observacao}</span>}
                  {e.fotoUrl && (
                    <a href={e.fotoUrl} target="_blank" rel="noopener noreferrer" title="Ver foto do motorista">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.fotoUrl}
                        alt={`Foto anexada em ${LABEL_EVENTO[e.tipo_evento] ?? e.tipo_evento}`}
                        className="h-8 w-8 rounded border border-slate-200 object-cover hover:opacity-80"
                      />
                    </a>
                  )}
                </span>
                <span className="text-xs text-slate-400">{new Date(e.criado_em).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {freteTipado.status === "concluido" && (
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">⭐ Avaliação</h2>
          {avaliacaoMotorista && (
            <p className="mb-2 text-sm text-slate-600">
              Você avaliou o motorista: {"★".repeat(avaliacaoMotorista.estrelas)}
              {avaliacaoMotorista.comentario && ` — ${avaliacaoMotorista.comentario}`}
            </p>
          )}
          {!avaliacaoMotorista && <AvaliarMotoristaForm freteId={id} empresaId={empresaId} />}
          {avaliacaoCliente && (
            <p className="mt-3 text-sm text-slate-600">
              O motorista avaliou você: {"★".repeat(avaliacaoCliente.estrelas)}
              {avaliacaoCliente.comentario && ` — ${avaliacaoCliente.comentario}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
