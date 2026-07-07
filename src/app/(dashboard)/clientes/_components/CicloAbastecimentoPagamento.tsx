import Link from "next/link";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import { STATUS_NEGOCIACAO_LABEL, type StatusNegociacao } from "@/lib/negociacoesPostos";
import {
  STATUS_FATURA_LABEL,
  statusFaturaExibicao,
  type StatusFaturaExibicao,
} from "@/lib/financeiroPostos";
import { FormularioCicloPagamento } from "./FormularioCicloPagamento";

export type NegociacaoDoCliente = {
  id: string;
  posto_nome: string | null;
  status: string;
  combustivel: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  volume_minimo_mensal: number | null;
  preco_unitario: number | null;
  // Fase 27.80 — ciclo de faturamento + prazo de vencimento: parâmetro
  // administrativo por relação cliente+posto (não termo negociado), editável
  // só pelo admin via FormularioCicloPagamento.
  ciclo_faturamento_dias: number;
  prazo_vencimento_dias: number;
};

export type FaturaDoCliente = {
  id: string;
  posto_nome: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  vencimento: string;
  valor_total: number;
  status: string;
};

// Fase 27.71 — pedido do Daniel: um resumo NOVO na tela de detalhe do
// cliente (/clientes/[id], visão admin), consolidando o ciclo de
// abastecimento + pagamento desse cliente com TODOS os postos que ele já
// negociou — não é só reaproveitar as telas de /negociacoes ou
// /financeiro-posto (que são por posto), é uma visão de rede, cross-posto,
// olhando o cliente de fora (papel da FNI: acompanhar a saúde financeira de
// cada cliente perante os postos que ele abastece).
export function CicloAbastecimentoPagamento({
  negociacoes,
  faturas,
  podeEditarCiclo = false,
}: {
  negociacoes: NegociacaoDoCliente[];
  faturas: FaturaDoCliente[];
  // Fase 27.80 — só a visão admin (/clientes/[id]) passa true; a visão do
  // posto (/clientes-posto/[clienteId]) reaproveita este mesmo componente
  // mas nunca mostra o controle de edição (ciclo/prazo é decisão da FNI).
  podeEditarCiclo?: boolean;
}) {
  const hojeIso = new Date().toISOString().slice(0, 10);

  const negociacoesVigentes = negociacoes.filter(
    (n) =>
      n.status === "aceita" &&
      n.vigencia_inicio !== null &&
      n.vigencia_fim !== null &&
      n.vigencia_inicio <= hojeIso &&
      n.vigencia_fim >= hojeIso
  );
  const postosComNegociacao = new Set(negociacoes.map((n) => n.posto_nome ?? "")).size;
  const volumeContratadoTotal = negociacoesVigentes.reduce((s, n) => s + (n.volume_minimo_mensal ?? 0), 0);

  const faturasAbertas = faturas.filter((f) => f.status === "aberta");
  const totalEmAberto = faturasAbertas.reduce((s, f) => s + f.valor_total, 0);
  const faturasVencidas = faturasAbertas.filter((f) => f.vencimento < hojeIso);
  const totalVencido = faturasVencidas.reduce((s, f) => s + f.valor_total, 0);
  const totalPago = faturas.filter((f) => f.status === "paga").reduce((s, f) => s + f.valor_total, 0);

  const proximaFatura = faturasAbertas
    .filter((f) => f.vencimento >= hojeIso)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Ciclo de abastecimento e pagamento</h2>
        <p className="text-sm text-slate-500">
          Resumo consolidado de todas as negociações e faturas deste cliente com os postos revendedores
          (visão de rede — cruza todos os postos, não só um).
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador label="Postos com negociação" valor={String(postosComNegociacao)} />
        <Indicador label="Negociações vigentes" valor={String(negociacoesVigentes.length)} />
        <Indicador label="Volume mín. contratado/mês" valor={`${volumeContratadoTotal.toLocaleString("pt-BR")} L`} />
        <Indicador label="Em aberto" valor={formatarMoeda(totalEmAberto)} />
        <Indicador
          label="Vencido"
          valor={formatarMoeda(totalVencido)}
          destaque={totalVencido > 0 ? "negativo" : undefined}
        />
        <Indicador label="Pago (histórico)" valor={formatarMoeda(totalPago)} destaque="positivo" />
      </div>

      {proximaFatura && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Próxima fatura a vencer: <strong>{formatarMoeda(proximaFatura.valor_total)}</strong> em{" "}
          {formatarDataBr(proximaFatura.vencimento)} ({proximaFatura.posto_nome ?? "posto não identificado"}).
        </div>
      )}

      <div className="mb-6 card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Negociações com postos</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Posto</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Vigência</th>
              <th className="px-4 py-3">Volume mín./mês</th>
              <th className="px-4 py-3">Preço/L</th>
              <th className="px-4 py-3">Ciclo+prazo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {negociacoes.map((n) => (
              <tr key={n.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{n.posto_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{n.combustivel ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {n.vigencia_inicio && n.vigencia_fim
                    ? `${formatarDataBr(n.vigencia_inicio)} – ${formatarDataBr(n.vigencia_fim)}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {n.volume_minimo_mensal != null ? `${n.volume_minimo_mensal.toLocaleString("pt-BR")} L` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {n.preco_unitario != null
                    ? n.preco_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {podeEditarCiclo && n.status === "aceita" ? (
                    <FormularioCicloPagamento
                      negociacaoId={n.id}
                      cicloAtual={n.ciclo_faturamento_dias}
                      prazoAtual={n.prazo_vencimento_dias}
                    />
                  ) : (
                    `${n.ciclo_faturamento_dias}+${n.prazo_vencimento_dias} dias`
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {STATUS_NEGOCIACAO_LABEL[n.status as StatusNegociacao] ?? n.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/negociacoes/${n.id}`} className="text-frota-600 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {negociacoes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Este cliente ainda não negociou com nenhum posto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Faturas</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Posto</th>
              <th className="px-4 py-3">Período</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {faturas.map((f) => {
              const statusExib = statusFaturaExibicao(f.status, f.vencimento, hojeIso);
              return (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{f.posto_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatarDataBr(f.periodo_inicio)} – {formatarDataBr(f.periodo_fim)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatarDataBr(f.vencimento)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{formatarMoeda(f.valor_total)}</td>
                  <td className="px-4 py-3">
                    <BadgeStatusFatura status={statusExib} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/faturas-postos/${f.id}`} className="text-frota-600 hover:underline">
                      Ver extrato
                    </Link>
                  </td>
                </tr>
              );
            })}
            {faturas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma fatura gerada ainda para este cliente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Indicador({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: "positivo" | "negativo";
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          destaque === "negativo" ? "text-red-600" : destaque === "positivo" ? "text-green-700" : "text-slate-900"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

function BadgeStatusFatura({ status }: { status: StatusFaturaExibicao }) {
  const cores: Record<StatusFaturaExibicao, string> = {
    aberta: "bg-slate-100 text-slate-700",
    vencida: "bg-red-100 text-red-700",
    paga: "bg-green-100 text-green-700",
    cancelada: "bg-slate-100 text-slate-400 line-through",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cores[status]}`}>
      {STATUS_FATURA_LABEL[status]}
    </span>
  );
}
