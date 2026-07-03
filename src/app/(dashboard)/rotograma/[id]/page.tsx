import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { VisualizacaoRotograma } from "../_components/VisualizacaoRotograma";
import { LinhaDoTempoRotograma } from "../_components/LinhaDoTempoRotograma";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { BotaoExcluirRotograma } from "../_components/BotaoExcluirRotograma";
import BotaoBaixarPdfRotogramaLazy from "../_components/BotaoBaixarPdfRotogramaLazy";
import type { RotogramaParada, RotogramaRisco } from "../tipos";

export default async function RotogramaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rotograma } = await supabase
    .from("rotogramas")
    .select("*, empresas(nome)")
    .eq("id", id)
    .maybeSingle();

  if (!rotograma) notFound();

  const riscos = (rotograma.riscos as RotogramaRisco[] | null) ?? [];
  const paradas = (rotograma.paradas as RotogramaParada[] | null) ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/rotograma" className="mb-2 inline-block text-xs text-slate-500 hover:underline">
            ← Voltar para Rotogramas
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">
            Rotograma #{rotograma.numero} — {rotograma.origem} → {rotograma.destino}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {rotograma.empresas?.nome ? `${rotograma.empresas.nome} · ` : ""}
            Criado em {formatDate(rotograma.criado_em)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/rotograma/${rotograma.id}/editar`} className="btn-secondary">
            Editar
          </Link>
          <BotaoBaixarPdfRotogramaLazy
            nomeArquivo={`rotograma-${rotograma.numero}.pdf`}
            origem={rotograma.origem ?? ""}
            destino={rotograma.destino ?? ""}
            motorista={rotograma.motorista ?? undefined}
            placa={rotograma.placa ?? undefined}
            dataViagem={rotograma.data_viagem ? formatDate(rotograma.data_viagem) : undefined}
            numero={rotograma.numero}
            riscos={riscos}
            paradas={paradas}
          />
          <BotaoExcluirRotograma id={rotograma.id} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Motorista" valor={rotograma.motorista ?? "—"} />
        <Indicador label="Veículo / Placa" valor={[rotograma.veiculo, rotograma.placa].filter(Boolean).join(" · ") || "—"} />
        <Indicador label="Data da viagem" valor={rotograma.data_viagem ? formatDate(rotograma.data_viagem) : "—"} />
        <Indicador label="Carga" valor={rotograma.carga ?? "—"} />
      </div>

      {rotograma.observacoes && (
        <div className="mb-6 card p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Observações</p>
          <p className="text-sm text-slate-700">{rotograma.observacoes}</p>
        </div>
      )}

      <div className="mb-6 card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          🗺️ Linha do tempo da viagem <AjudaIcon chave="rotograma.linha_tempo_riscos" />
        </h2>
        <LinhaDoTempoRotograma
          origem={rotograma.origem ?? ""}
          destino={rotograma.destino ?? ""}
          riscos={riscos}
          paradas={paradas}
        />
        {riscos.length === 0 && paradas.length === 0 && (
          <p className="text-sm text-slate-400">Adicione pontos de risco ou parada para ver a linha do tempo.</p>
        )}
      </div>

      <VisualizacaoRotograma riscos={riscos} paradas={paradas} />
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
