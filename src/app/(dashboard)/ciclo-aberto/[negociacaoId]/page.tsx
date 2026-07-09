import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";

// Fase 27.93 — pedido do Daniel (com print de "Ciclos por posto"): o ciclo
// em andamento (ainda não fechado pelo robô, Fase 27.84) só mostrava
// período + valor acumulado — sem quantidade de abastecimentos, e sem
// nenhum jeito de ver QUAIS abastecimentos estão dentro dele (esse
// detalhamento só existia pra fatura já FECHADA, Fase 27.76/27.92). Esta
// tela é o equivalente do /faturas-postos/[id] pro ciclo ainda ABERTO —
// período/valor/quantidade PREVISTOS (podem mudar até o fechamento) e a
// lista de abastecimentos que compõem esse valor. Acessível às 3 visões
// (cliente, posto, admin), mesma RLS/guarda de abastecimentos_do_ciclo_aberto.
export default async function CicloAbertoPage({ params }: { params: Promise<{ negociacaoId: string }> }) {
  const { negociacaoId } = await params;
  const supabase = await createClient();

  const { data: ciclosAbertos } = await supabase.rpc("ciclos_abertos_postos");
  const ciclo = (ciclosAbertos ?? []).find((c) => c.negociacao_id === negociacaoId);

  if (!ciclo) notFound();

  const { data: abastecimentosData } = await supabase.rpc("abastecimentos_do_ciclo_aberto", {
    p_negociacao_id: negociacaoId,
  });
  const abastecimentos = abastecimentosData ?? [];

  return (
    <div>
      <Link href="/financeiro-posto" className="text-sm text-frota-600 hover:underline">
        ← Voltar
      </Link>

      <div className="mt-3 mb-2">
        <h1 className="text-xl font-semibold text-slate-900">
          Ciclo em andamento — {ciclo.posto_nome ?? "Posto"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Cliente: {ciclo.cliente_nome ?? "—"}</p>
      </div>

      <div className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Período, vencimento e valor são PREVISTOS e podem mudar até o fechamento — o robô fecha
        automaticamente quando o ciclo termina, virando uma fatura de verdade.
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Indicador
          label="Período (previsto)"
          valor={`${formatarDataBr(ciclo.periodo_inicio)} – ${formatarDataBr(ciclo.periodo_fim_previsto)}`}
        />
        <Indicador label="Vencimento (previsto)" valor={formatarDataBr(ciclo.vencimento_previsto)} />
        <Indicador label="Status" valor="Em andamento" />
        <Indicador label="Volume acumulado" valor={`${ciclo.volume_acumulado.toLocaleString("pt-BR")} L`} />
        <Indicador label="Valor acumulado" valor={formatarMoeda(ciclo.valor_acumulado)} />
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Detalhamento do abastecimento ({ciclo.quantidade_abastecimentos})
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Abastecimentos já registrados no ciclo atual que compõem o valor acumulado acima.
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Litros</th>
              <th className="px-4 py-3">Preço/L</th>
              <th className="px-4 py-3">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {abastecimentos.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">
                  {a.data_abastecimento ? formatarDataBr(a.data_abastecimento) : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{a.motorista_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{a.veiculo_placa ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{a.item_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {a.item_quantidade != null ? a.item_quantidade.toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {a.item_valor_unitario != null ? formatarMoeda(a.item_valor_unitario) : "—"}
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">
                  {a.item_valor_total != null ? formatarMoeda(a.item_valor_total) : "—"}
                </td>
              </tr>
            ))}
            {abastecimentos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum abastecimento registrado neste ciclo ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
