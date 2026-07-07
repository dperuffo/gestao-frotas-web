import Link from "next/link";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import { STATUS_FATURA_LABEL, statusFaturaExibicao, type StatusFaturaExibicao } from "@/lib/financeiroPostos";

export type FaturaCobranca = {
  id: string;
  posto_nome: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  vencimento: string;
  valor_total: number;
  status: string;
};

// Fase 27.75 — pedido do Daniel: o painel financeiro do cliente precisa
// mostrar a cobrança em aberto (o que o cliente deve aos postos, faturado
// por faturas_postos) — antes só existia essa visão do lado do POSTO
// (/financeiro-posto, "A receber"). Este componente é o espelho do lado do
// CLIENTE: o que ELE deve, cruzando todos os postos com quem negociou.
export function CobrancaEmAberto({ faturas }: { faturas: FaturaCobranca[] }) {
  const hojeIso = new Date().toISOString().slice(0, 10);

  const abertas = faturas.filter((f) => f.status === "aberta");
  const totalEmAberto = abertas.reduce((s, f) => s + f.valor_total, 0);
  const vencidas = abertas.filter((f) => f.vencimento < hojeIso);
  const totalVencido = vencidas.reduce((s, f) => s + f.valor_total, 0);
  const proximaFatura = abertas
    .filter((f) => f.vencimento >= hojeIso)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];

  return (
    <div className="mt-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Cobrança em aberto</h2>
        <p className="text-sm text-slate-500">
          Faturas emitidas pelos postos com quem sua empresa negociou (contas a pagar).
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador label="Total em aberto" valor={formatarMoeda(totalEmAberto)} />
        <Indicador
          label="Vencido"
          valor={formatarMoeda(totalVencido)}
          destaque={totalVencido > 0 ? "negativo" : undefined}
        />
        <Indicador label="Faturas em aberto" valor={String(abertas.length)} />
      </div>

      {proximaFatura && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Próxima fatura a vencer: <strong>{formatarMoeda(proximaFatura.valor_total)}</strong> em{" "}
          {formatarDataBr(proximaFatura.vencimento)} ({proximaFatura.posto_nome ?? "posto não identificado"}).
        </div>
      )}

      <div className="card overflow-x-auto">
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
                    <BadgeStatus status={statusExib} />
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
                  Nenhuma fatura emitida ainda.
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

function BadgeStatus({ status }: { status: StatusFaturaExibicao }) {
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
