import Link from "next/link";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import type { CicloAberto } from "@/lib/ciclosAbertos";

// Fase 27.84 — pedido do Daniel: os painéis financeiros só mostravam
// ciclos JÁ FECHADOS — o ciclo atual, em andamento, nunca aparecia em
// nenhuma tela até o robô fechar ele no dia seguinte. Esta seção mostra o(s)
// ciclo(s) em andamento, com período/vencimento PREVISTOS (ainda pode
// mudar até o fechamento) e os abastecimentos já acumulados até hoje.
// Compartilhada entre /financeiro-posto, /financeiro (cliente) e
// CicloAbastecimentoPagamento (/clientes/[id] admin e /clientes-posto/[id]
// posto) — `rotulo` decide se a coluna principal mostra o nome do posto ou
// do cliente (dependendo de quem está olhando).
export function SecaoCiclosAbertos({
  ciclos,
  rotulo,
}: {
  ciclos: CicloAberto[];
  rotulo: "posto" | "cliente";
}) {
  if (ciclos.length === 0) return null;

  const totalAcumulado = ciclos.reduce((s, c) => s + c.valor_acumulado, 0);

  return (
    <div className="mb-6 card overflow-x-auto">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Ciclo em andamento</h3>
        <p className="mt-1 text-xs text-slate-500">
          Abastecimentos já registrados no ciclo atual, ainda não fechado — período, vencimento e valor são
          PREVISTOS e podem mudar até o fechamento (o robô fecha automaticamente quando o ciclo termina).
          {" "}Total acumulado: <strong className="text-slate-700">{formatarMoeda(totalAcumulado)}</strong>.
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">{rotulo === "posto" ? "Cliente" : "Posto"}</th>
            <th className="px-4 py-3">Período (previsto)</th>
            <th className="px-4 py-3">Vencimento (previsto)</th>
            <th className="px-4 py-3">Abastecimentos</th>
            <th className="px-4 py-3">Volume</th>
            <th className="px-4 py-3">Valor acumulado</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ciclos.map((c) => (
            <tr key={c.negociacao_id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700">
                {(rotulo === "posto" ? c.cliente_nome : c.posto_nome) ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {formatarDataBr(c.periodo_inicio)} – {formatarDataBr(c.periodo_fim_previsto)}
              </td>
              <td className="px-4 py-3 text-slate-500">{formatarDataBr(c.vencimento_previsto)}</td>
              <td className="px-4 py-3 text-slate-500">{c.quantidade_abastecimentos}</td>
              <td className="px-4 py-3 text-slate-500">{c.volume_acumulado.toLocaleString("pt-BR")} L</td>
              <td className="px-4 py-3 font-medium text-slate-700">{formatarMoeda(c.valor_acumulado)}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Em andamento
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {/* Fase 27.93 — pedido do Daniel: dar acesso ao detalhamento de QUAIS
                    abastecimentos compõem o valor acumulado do ciclo em andamento. */}
                <Link href={`/ciclo-aberto/${c.negociacao_id}`} className="text-frota-600 hover:underline">
                  Ver detalhamento
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
