import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import type { CicloAberto, LinhaContraparte } from "@/lib/ciclosAbertos";
import { VisaoCiclosPorContraparte } from "../../_components/VisaoCiclosPorContraparte";

export type FaturaCobranca = {
  id: string;
  empresa_posto_id: string;
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
//
// Fase 27.85 — pedido do Daniel: mesmo problema de escala do lado do
// posto (muitos ciclos, muitas contrapartes) pode acontecer aqui se o
// cliente negociar com muitos postos — a lista plana de faturas virou a
// visão agrupada por posto (VisaoCiclosPorContraparte), reaproveitando a
// mesma agregação. KPIs/banner "próxima fatura" continuam vindo direto de
// `faturas` (retrospectivo/pontual, não precisa de agrupamento).
export function CobrancaEmAberto({
  faturas,
  linhas,
  empresaId,
  ciclosAbertos = [],
}: {
  faturas: FaturaCobranca[];
  linhas: LinhaContraparte[];
  empresaId: string;
  // Fase 27.91 — pedido do Daniel: o ciclo em andamento (ainda não fechado
  // pelo robô) já representa valor devido — soma no "Total em aberto" e
  // "Faturas em aberto" mesmo antes de virar fatura real.
  ciclosAbertos?: CicloAberto[];
}) {
  const hojeIso = new Date().toISOString().slice(0, 10);

  // Fase CICLOS-6 — "aberta" virou 2 status: "fechada" (janela terminou,
  // boleto ainda não gerado, valor ainda 0) e "a_vencer" (boleto gerado,
  // valor travado, aguardando pagamento). "Em aberto" conta os dois;
  // vencida/próxima fatura só fazem sentido pra quem já tem valor e
  // vencimento reais (a_vencer).
  const abertas = faturas.filter((f) => f.status === "fechada" || f.status === "a_vencer");
  const totalCicloAtual = ciclosAbertos.reduce((s, c) => s + c.valor_acumulado, 0);
  const totalEmAberto = abertas.reduce((s, f) => s + f.valor_total, 0) + totalCicloAtual;
  const aVencer = faturas.filter((f) => f.status === "a_vencer");
  const vencidas = aVencer.filter((f) => f.vencimento < hojeIso);
  const totalVencido = vencidas.reduce((s, f) => s + f.valor_total, 0);
  const proximaFatura = aVencer
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
        <Indicador label="Faturas em aberto" valor={String(abertas.length + ciclosAbertos.length)} />
      </div>

      {proximaFatura && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Próxima fatura a vencer: <strong>{formatarMoeda(proximaFatura.valor_total)}</strong> em{" "}
          {formatarDataBr(proximaFatura.vencimento)} ({proximaFatura.posto_nome ?? "posto não identificado"}).
        </div>
      )}

      <VisaoCiclosPorContraparte
        linhas={linhas}
        rotulo="cliente"
        hrefBase="/meus-postos"
        empresaId={empresaId}
      />
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
