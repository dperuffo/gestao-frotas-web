import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda, formatarDataSemFuso, sugerirContas, STATUS_EXTRATO_LABEL, STATUS_EXTRATO_COR, type ContaEmAberto } from "@/lib/conciliacaoBancaria";
import { FormImportarExtrato } from "./_components/FormImportarExtrato";
import { AcoesLancamentoExtrato } from "./_components/AcoesLancamentoExtrato";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// em Dashboard/Veículos/Financeiro/Abastecimentos/Manutenção/Notas
// Fiscais/Centros de Custo.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { ListChecks, Wallet, CheckCircle2 } from "lucide-react";

type SearchParams = { empresa?: string };

// Fase Grupo 1 Rodopar item 3 (03/08/2026, benchmark FNI vs Rodopar/Datapar)
// — Conciliação Bancária Simples. Fecha o gap do módulo "Banco" do Rodopar
// com o menor escopo que ainda resolve o problema real (bater extrato com o
// que já está lançado): importa OFX/CSV, sugere vínculo com contas_pagar/
// contas_receber em aberto por valor+data, confirma a baixa com um clique.
// Sem integração de Open Finance — fora de escopo do "simples".
export default async function ConciliacaoBancariaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  type LancamentoLinha = {
    id: string;
    data: string;
    descricao: string;
    valor: number;
    tipo: "credito" | "debito";
    conta_bancaria: string | null;
    status: string;
    conciliado_com_tipo: string | null;
    conciliado_com_id: string | null;
    conciliado_em: string | null;
  };

  let lancamentos: LancamentoLinha[] = [];
  let contasPagarAbertas: ContaEmAberto[] = [];
  let contasReceberAbertas: ContaEmAberto[] = [];

  if (empresaSelecionada) {
    const [{ data: pagarData }, { data: receberData }] = await Promise.all([
      supabase
        .from("contas_pagar")
        .select("id, credor_nome, descricao, valor_original, valor_pago, vencimento")
        .eq("empresa_id", empresaSelecionada)
        .in("status", ["aberto", "baixado_parcial"]),
      supabase
        .from("contas_receber")
        .select("id, devedor_nome, descricao, valor_original, valor_pago, vencimento")
        .eq("empresa_id", empresaSelecionada)
        .in("status", ["aberto", "baixado_parcial"]),
    ]);

    // Fase Auditoria-Paginacao (17/08/2026, risco médio) — achado real: cap
    // fixo de 300 alimentava o indicador "Pendentes" (podia esconder
    // pendências mais antigas que o extrato mais recente importado). Busca
    // em lotes de 1.000 até esgotar.
    const LOTE_LANCAMENTOS = 1000;
    const lancamentosData: LancamentoLinha[] = [];
    let offsetBusca = 0;
    for (;;) {
      const { data: lote } = await supabase
        .from("extrato_bancario_lancamentos")
        .select("id, data, descricao, valor, tipo, conta_bancaria, status, conciliado_com_tipo, conciliado_com_id, conciliado_em")
        .eq("empresa_id", empresaSelecionada)
        .order("data", { ascending: false })
        .range(offsetBusca, offsetBusca + LOTE_LANCAMENTOS - 1);
      const linhas = (lote ?? []) as LancamentoLinha[];
      if (linhas.length === 0) break;
      lancamentosData.push(...linhas);
      if (linhas.length < LOTE_LANCAMENTOS) break;
      offsetBusca += LOTE_LANCAMENTOS;
    }

    lancamentos = lancamentosData;
    contasPagarAbertas = (pagarData ?? []).map((c) => ({
      id: c.id,
      nome: c.credor_nome ?? "Credor não identificado",
      descricao: c.descricao,
      saldoEmAberto: c.valor_original - c.valor_pago,
      vencimento: c.vencimento,
    }));
    contasReceberAbertas = (receberData ?? []).map((c) => ({
      id: c.id,
      nome: c.devedor_nome ?? "Devedor não identificado",
      descricao: c.descricao,
      saldoEmAberto: c.valor_original - c.valor_pago,
      vencimento: c.vencimento,
    }));
  }

  const pendentes = lancamentos.filter((l) => l.status === "pendente");
  const conciliados = lancamentos.filter((l) => l.status === "conciliado");
  const hojeIso = new Date().toISOString().slice(0, 10);
  const inicioMesIso = hojeIso.slice(0, 7) + "-01";
  const conciliadosNoMes = conciliados.filter((l) => (l.conciliado_em ?? "") >= inicioMesIso);
  const valorPendente = pendentes.reduce((s, l) => s + Math.abs(l.valor), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Conciliação Bancária</h1>
        <p className="mt-1 text-sm text-slate-500">
          Importe o extrato do banco (OFX ou CSV) e concilie cada lançamento com uma conta a pagar ou a receber já
          lançada — a baixa é confirmada automaticamente ao vincular.
        </p>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {empresas.length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para importar e conciliar o extrato bancário dele.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="amber" icon={ListChecks} label="Pendentes" valor={String(pendentes.length)} />
            <IndicadorColorido cor="sky" icon={Wallet} label="Valor pendente" valor={formatarMoeda(valorPendente)} />
            <IndicadorColorido cor="green" icon={CheckCircle2} label="Conciliados no mês" valor={String(conciliadosNoMes.length)} />
          </div>

          <div className="card mb-6 p-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Importar extrato</h2>
            <FormImportarExtrato empresaId={empresaSelecionada} />
          </div>

          <div className="card mb-6 overflow-x-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Lançamentos pendentes</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Vínculo com conta a pagar/receber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendentes.map((l) => {
                  const contasCandidatas = l.tipo === "debito" ? contasPagarAbertas : contasReceberAbertas;
                  const sugestoes = sugerirContas({ data: l.data, valor: Math.abs(l.valor) }, contasCandidatas);
                  return (
                    <tr key={l.id} className="transition-colors hover:bg-frota-50/60">
                      <td className="px-4 py-3 text-slate-600 align-top">{formatarDataSemFuso(l.data)}</td>
                      <td className="px-4 py-3 text-slate-700 align-top">
                        {l.descricao}
                        {l.conta_bancaria && <span className="ml-2 text-xs text-slate-400">({l.conta_bancaria})</span>}
                      </td>
                      <td className={`px-4 py-3 align-top tabular-nums font-medium ${l.tipo === "debito" ? "text-red-700" : "text-green-700"}`}>
                        {l.tipo === "debito" ? "-" : "+"}
                        {formatarMoeda(Math.abs(l.valor))}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <AcoesLancamentoExtrato
                          lancamentoId={l.id}
                          tipo={l.tipo}
                          valorLancamento={Math.abs(l.valor)}
                          sugestoes={sugestoes}
                          contasCandidatas={contasCandidatas}
                        />
                      </td>
                    </tr>
                  );
                })}
                {pendentes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Nenhum lançamento pendente. Importe um extrato acima.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card overflow-x-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Histórico (últimos {lancamentos.length})</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lancamentos
                  .filter((l) => l.status !== "pendente")
                  .map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-frota-50/60">
                      <td className="px-4 py-3 text-slate-600">{formatarDataSemFuso(l.data)}</td>
                      <td className="px-4 py-3 text-slate-700">{l.descricao}</td>
                      <td className={`px-4 py-3 tabular-nums font-medium ${l.tipo === "debito" ? "text-red-700" : "text-green-700"}`}>
                        {l.tipo === "debito" ? "-" : "+"}
                        {formatarMoeda(Math.abs(l.valor))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_EXTRATO_COR[l.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {STATUS_EXTRATO_LABEL[l.status] ?? l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                {lancamentos.filter((l) => l.status !== "pendente").length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Nenhum lançamento conciliado ou ignorado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
