import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_MULTA_LABEL, STATUS_MULTA_COR, GRAVIDADE_MULTA_LABEL } from "@/lib/multas";
import { empresasIrmasAcao } from "@/lib/empresasGrupo";
import { IndicarCondutorForm, StatusMultaBotoes, ExcluirMultaButton } from "../_components/MultaAcoes";

export default async function MultaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: multa } = await supabase
    .from("multas")
    .select(
      "id, empresa_id, placa, motorista_id, numero_ait, orgao_autuador, local_infracao, data_infracao, data_limite_indicacao, descricao, gravidade, pontos, valor_original, valor_desconto, status, anexo_path, observacoes, indicado_em, indicado_por, pago_em, criado_em, motoristas(id, nome_completo)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!multa) notFound();

  // Fase Onda-2 (benchmark TicketLog, item #4) — sugestão de condutor:
  // reaproveita o vínculo Motorista<->Veículo já existente em Parâmetros de
  // Uso (parametros_vinculo_motorista_veiculo), resolvendo qual vínculo
  // estava ATIVO na data da infração (não necessariamente hoje).
  const { data: vinculoAtivo } = await supabase
    .from("parametros_vinculo_motorista_veiculo")
    .select("motorista_id")
    .eq("placa", multa.placa)
    .eq("status", "Ativo")
    .lte("data_inicio", multa.data_infracao)
    .or(`data_fim.is.null,data_fim.gte.${multa.data_infracao}`)
    .maybeSingle();

  // Fase Reuso-Operacional-Grupo (Fase 2) — motorista de empresa irmã do
  // grupo também entra como opção de condutor, rotulado com a empresa dona
  // do cadastro (o veículo já pode ter sido "emprestado" nesse cenário).
  const irmas = await empresasIrmasAcao(supabase, multa.empresa_id);
  const nomePorEmpresaId = new Map(irmas.map((e) => [e.id, e.nome]));
  const idsIrmas = irmas.map((e) => e.id);

  const [{ data: motoristasData }, { data: motoristasGrupoData }] = await Promise.all([
    supabase.from("motoristas").select("id, nome_completo").eq("empresa_id", multa.empresa_id).order("nome_completo"),
    idsIrmas.length > 0
      ? supabase.from("motoristas").select("id, nome_completo, empresa_id").in("empresa_id", idsIrmas).order("nome_completo")
      : Promise.resolve({ data: [] as { id: string; nome_completo: string; empresa_id: string }[] }),
  ]);

  const motoristas = [
    ...(motoristasData ?? []),
    ...(motoristasGrupoData ?? []).map((m) => ({ id: m.id, nome_completo: m.nome_completo, empresaNome: nomePorEmpresaId.get(m.empresa_id) })),
  ];

  const { data: historicoVeiculo } = await supabase
    .from("multas")
    .select("id, data_infracao, descricao, status")
    .eq("placa", multa.placa)
    .neq("id", multa.id)
    .order("data_infracao", { ascending: false })
    .limit(10);

  let anexoUrl: string | null = null;
  if (multa.anexo_path) {
    const { data } = await supabase.storage.from("multas-anexos").createSignedUrl(multa.anexo_path, 3600);
    anexoUrl = data?.signedUrl ?? null;
  }

  const motoristaVinculado = multa.motoristas as unknown as { id: string; nome_completo: string } | null;

  return (
    <div>
      <div className="mb-6">
        <Link href={`/multas?empresa=${multa.empresa_id}`} className="text-sm text-frota-600 hover:underline">
          ← Voltar
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            Multa — {multa.placa} {multa.numero_ait ? `· AIT ${multa.numero_ait}` : ""}
          </h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_MULTA_COR[multa.status] ?? "bg-slate-100 text-slate-600"}`}>
            {STATUS_MULTA_LABEL[multa.status] ?? multa.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-3 p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700">Dados da infração</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Campo label="Data da infração" valor={new Date(`${multa.data_infracao}T00:00:00`).toLocaleDateString("pt-BR")} />
            <Campo
              label="Prazo p/ indicação/desconto"
              valor={multa.data_limite_indicacao ? new Date(`${multa.data_limite_indicacao}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
            />
            <Campo label="Órgão autuador" valor={multa.orgao_autuador ?? "—"} />
            <Campo label="Local" valor={multa.local_infracao ?? "—"} />
            <Campo label="Descrição" valor={multa.descricao ?? "—"} />
            <Campo label="Gravidade" valor={multa.gravidade ? (GRAVIDADE_MULTA_LABEL[multa.gravidade] ?? multa.gravidade) : "—"} />
            <Campo label="Pontos na CNH" valor={multa.pontos != null ? String(multa.pontos) : "—"} />
            <Campo
              label="Valor original"
              valor={multa.valor_original != null ? multa.valor_original.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            />
            <Campo
              label="Valor com desconto"
              valor={multa.valor_desconto != null ? multa.valor_desconto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
            />
            <Campo label="Observações" valor={multa.observacoes ?? "—"} />
          </dl>

          {anexoUrl && (
            <div>
              <a href={anexoUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-frota-600 hover:underline">
                📎 Ver anexo da notificação
              </a>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <StatusMultaBotoes multaId={multa.id} status={multa.status} />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <ExcluirMultaButton id={multa.id} empresaId={multa.empresa_id} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Condutor infrator</h2>
            {motoristaVinculado ? (
              <div>
                <p className="text-sm text-slate-700">{motoristaVinculado.nome_completo}</p>
                {multa.indicado_em && (
                  <p className="mt-1 text-xs text-slate-400">
                    Indicado em {new Date(multa.indicado_em).toLocaleDateString("pt-BR")}
                    {multa.indicado_por ? ` por ${multa.indicado_por}` : ""}
                  </p>
                )}
              </div>
            ) : (
              <IndicarCondutorForm multaId={multa.id} motoristas={motoristas ?? []} motoristaSugeridoId={vinculoAtivo?.motorista_id ?? null} />
            )}
          </div>

          <div className="card space-y-2 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Histórico do veículo ({multa.placa})</h2>
            {historicoVeiculo && historicoVeiculo.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {historicoVeiculo.map((h) => (
                  <li key={h.id}>
                    <Link href={`/multas/${h.id}`} className="text-frota-600 hover:underline">
                      {new Date(`${h.data_infracao}T00:00:00`).toLocaleDateString("pt-BR")}
                    </Link>{" "}
                    <span className="text-slate-500">— {h.descricao ?? STATUS_MULTA_LABEL[h.status] ?? h.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Nenhuma outra multa registrada para esse veículo.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{valor}</dd>
    </div>
  );
}
