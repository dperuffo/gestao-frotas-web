import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PainelPropostas, type Proposta } from "../_components/PainelPropostas";

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
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Propostas recebidas</h2>
          <PainelPropostas
            empresaId={empresaId}
            propostas={(propostas ?? []) as unknown as Proposta[]}
            freteAberto={freteTipado.status === "disponivel"}
          />
        </div>
      )}
    </div>
  );
}
