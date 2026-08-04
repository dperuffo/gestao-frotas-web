import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIPO_MOVIMENTO_LABEL, TIPO_MOVIMENTO_COR, formatarMoeda } from "@/lib/estoquePecas";
import { RegistrarMovimentoForm, DesativarPecaButton } from "../_components/EstoquePecasAcoes";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

export default async function PecaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { id } = await params;
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  const { data: peca } = await supabase
    .from("pecas_estoque")
    .select("id, empresa_id, nome, codigo, unidade_medida, quantidade_atual, quantidade_minima, custo_unitario_medio, ativa")
    .eq("id", id)
    .maybeSingle();

  if (!peca) notFound();

  const empresaId = empresaParam ?? peca.empresa_id;

  type MovimentoLinha = {
    id: string;
    tipo_movimento: string;
    quantidade: number;
    custo_unitario: number | null;
    placa: string | null;
    manutencao_id: number | null;
    motivo: string | null;
    criado_por: string | null;
    criado_em: string;
  };

  const { data: movimentosRaw } = await supabase
    .from("pecas_estoque_movimentos")
    .select("id, tipo_movimento, quantidade, custo_unitario, placa, manutencao_id, motivo, criado_por, criado_em")
    .eq("peca_id", id)
    .order("criado_em", { ascending: false })
    .limit(100);
  const movimentos = (movimentosRaw ?? []) as MovimentoLinha[];

  // Manutenções recentes da empresa — usadas no form de saída pra vincular o
  // consumo de peça a uma OS específica (a integração Materiais<->Manutenção
  // do gap Rodopar/Datapar).
  const { data: manutencoesRecentes } = await supabase
    .from("manutencoes_realizadas")
    .select("id, placa, data_manutencao, tipo")
    .eq("empresa_id", peca.empresa_id)
    .order("data_manutencao", { ascending: false })
    .limit(50);

  const abaixo = peca.quantidade_atual <= peca.quantidade_minima;

  return (
    <div>
      <BotaoVoltar href={`/estoque-pecas?empresa=${empresaId}`} />
      <div className="mb-6">
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            {peca.nome} {peca.codigo ? <span className="text-slate-400">· {peca.codigo}</span> : null}
          </h1>
          {!peca.ativa && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Inativa</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-3 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Situação do estoque</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Saldo atual</dt>
                <dd className={`mt-0.5 text-lg font-semibold ${abaixo ? "text-red-700" : "text-slate-800"}`}>
                  {peca.quantidade_atual} {peca.unidade_medida}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Estoque mínimo</dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-800">
                  {peca.quantidade_minima} {peca.unidade_medida}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Custo médio</dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-800">{formatarMoeda(peca.custo_unitario_medio)}</dd>
              </div>
            </div>
            {abaixo && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Saldo abaixo (ou igual) ao estoque mínimo definido. Considere repor.
              </p>
            )}
            <div className="border-t border-slate-100 pt-3">
              <DesativarPecaButton pecaId={peca.id} ativa={peca.ativa} />
            </div>
          </div>

          <div className="card space-y-2 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Histórico de movimentos</h2>
            {movimentos.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Qtd.</th>
                    <th className="py-2 pr-3">Placa / OS</th>
                    <th className="py-2 pr-3">Motivo</th>
                    <th className="py-2 pr-3">Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movimentos.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 pr-3 text-slate-600">{new Date(m.criado_em).toLocaleString("pt-BR")}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TIPO_MOVIMENTO_COR[m.tipo_movimento] ?? "bg-slate-100 text-slate-600"}`}>
                          {TIPO_MOVIMENTO_LABEL[m.tipo_movimento] ?? m.tipo_movimento}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-slate-700">
                        {m.tipo_movimento === "saida" ? "-" : "+"}
                        {m.quantidade} {peca.unidade_medida}
                        {m.custo_unitario != null && <span className="ml-1 text-xs text-slate-400">({formatarMoeda(m.custo_unitario)}/un)</span>}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {m.placa ?? "—"}
                        {m.manutencao_id ? <span className="ml-1 text-xs text-slate-400">· OS #{m.manutencao_id}</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{m.motivo ?? "—"}</td>
                      <td className="py-2 pr-3 text-slate-500">{m.criado_por ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-400">Nenhum movimento registrado ainda.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Registrar movimento</h2>
            <RegistrarMovimentoForm pecaId={peca.id} empresaId={peca.empresa_id} manutencoes={manutencoesRecentes ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
