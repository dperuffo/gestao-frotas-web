import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLANO_LABEL, STATUS_EMPRESA_LABEL, type Plano, type StatusEmpresa } from "@/lib/constants";
import { buscarPrecosPlanos } from "@/lib/planosPrecos";

function formatarMoeda(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase 27.73 — indicadores financeiros DA FNI (não de um cliente ou posto
// específico): MRR/assinantes por plano, faturamento/inadimplência do mês
// (via `invoices`, alimentada pelo stripe-webhook) e churn/novos assinantes.
//
// Fase 27.78 — achado real (reportado pelo Daniel, print de /financeiro
// mostrando "Selecione um cliente" pro usuário admin): esse conteúdo só
// existia em /assinaturas — mas o item de menu que o admin vê é "Painel
// Financeiro" (aponta pra /financeiro), e ele SEMPRE caía no fluxo de
// "selecione um cliente" (o painel de custo/orçamento de UMA empresa), nunca
// via os indicadores da FNI. Extraído aqui como componente compartilhado —
// /assinaturas continua existindo (link direto, e pra quem sabe a URL), e
// /financeiro passa a renderizar isto pro admin quando nenhum cliente
// específico está selecionado (ver financeiro/page.tsx).
export async function IndicadoresFinanceirosFni() {
  const supabase = await createClient();

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);
  const inicioMesIso = inicioMes.toISOString();
  const fimMesIso = fimMes.toISOString();

  const [{ data: empresas, error }, precos, { data: invoicesDoMes }] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, nome, plano, status, trial_ends_at, stripe_customer_id, created_at, cancelado_em")
      .order("created_at", { ascending: false }),
    // Preço real de cada plano, direto do Stripe (Edge Function
    // planos-precos) — usado só pra ESTIMAR o MRR nesta tela; a cobrança de
    // verdade continua 100% no Stripe via stripe-webhook.
    buscarPrecosPlanos(),
    // Faturamento/inadimplência do mês, a partir de `invoices` (só
    // `pago`/`falhou` são gravados, ver stripe-webhook:
    // invoice.payment_succeeded/failed).
    supabase
      .from("invoices")
      .select("empresa_id, valor_cents, status")
      .gte("criado_em", inicioMesIso)
      .lte("criado_em", fimMesIso),
  ]);

  const lista = empresas ?? [];

  const porStatus = new Map<string, number>();
  let mrrCents = 0;
  const trialsEmRisco: typeof lista = [];

  for (const e of lista) {
    porStatus.set(e.status, (porStatus.get(e.status) ?? 0) + 1);
    if (e.status === "ativo") {
      mrrCents += precos?.[e.plano as Plano]?.unit_amount ?? 0;
    }
    if (e.status === "trial" && e.trial_ends_at) {
      const diasRestantes = Math.ceil((new Date(e.trial_ends_at).getTime() - Date.now()) / 86400000);
      if (diasRestantes <= 3) trialsEmRisco.push(e);
    }
  }

  const totalClientes = lista.length;
  const totalTrial = porStatus.get("trial") ?? 0;
  const totalAtivos = porStatus.get("ativo") ?? 0;
  const totalSuspensos = porStatus.get("suspenso") ?? 0;
  const totalCancelados = porStatus.get("cancelado") ?? 0;
  const taxaConversao = totalClientes > 0 ? Math.round((totalAtivos / totalClientes) * 100) : 0;

  // Faturamento e inadimplência do mês — direto de `invoices` (fonte real de
  // cobrança, diferente do MRR acima que é uma ESTIMATIVA a partir do preço
  // atual do plano de quem está "ativo" agora).
  const invoicesPagas = (invoicesDoMes ?? []).filter((i) => i.status === "pago");
  const invoicesFalhas = (invoicesDoMes ?? []).filter((i) => i.status === "falhou");
  const faturamentoMesCents = invoicesPagas.reduce((soma, i) => soma + i.valor_cents, 0);
  const inadimplenciaMesCents = invoicesFalhas.reduce((soma, i) => soma + i.valor_cents, 0);

  // Churn do mês: empresas canceladas dentro da janela (cancelado_em é
  // gravado pelo stripe-webhook em customer.subscription.deleted).
  const churnDoMes = lista.filter(
    (e) => e.cancelado_em && e.cancelado_em >= inicioMesIso && e.cancelado_em <= fimMesIso
  );

  // Novos assinantes do mês — aproximação: empresas com plano PAGO, criadas
  // dentro do mês (não existe uma coluna dedicada de "data de conversão pra
  // pago"; quem já nasce contratando um plano pago via /cadastro + checkout
  // no mesmo dia cai aqui). Quem começa em trial e converte depois não é
  // capturado por este critério — documentado como limitação conhecida.
  const novosAssinantesDoMes = lista.filter(
    (e) =>
      e.plano !== "gratuito" &&
      e.created_at &&
      e.created_at >= inicioMesIso &&
      e.created_at <= fimMesIso
  );

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar empresas: {error.message}</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador label="Total de clientes" valor={String(totalClientes)} />
        <Indicador label="Em trial" valor={String(totalTrial)} />
        <Indicador label="Ativos" valor={String(totalAtivos)} />
        <Indicador label="Suspensos" valor={String(totalSuspensos)} />
        <Indicador label="Cancelados" valor={String(totalCancelados)} />
        <Indicador label="MRR estimado" valor={formatarMoeda(mrrCents)} />
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Faturamento — {agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      </p>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Faturado no mês" valor={formatarMoeda(faturamentoMesCents)} />
        <Indicador
          label="Inadimplência no mês"
          valor={`${formatarMoeda(inadimplenciaMesCents)} (${invoicesFalhas.length})`}
          destaque={invoicesFalhas.length > 0 ? "negativo" : undefined}
        />
        <Indicador
          label="Novos assinantes"
          valor={String(novosAssinantesDoMes.length)}
          destaque={novosAssinantesDoMes.length > 0 ? "positivo" : undefined}
        />
        <Indicador
          label="Churn (cancelados)"
          valor={String(churnDoMes.length)}
          destaque={churnDoMes.length > 0 ? "negativo" : undefined}
        />
      </div>

      <div className="mb-6 card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Taxa de conversão (ativos / total)</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">{taxaConversao}%</p>
      </div>

      {trialsEmRisco.length > 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{trialsEmRisco.length}</strong> trial(s) expirando em até 3 dias sem plano contratado:{" "}
          {trialsEmRisco.map((e) => e.nome).join(", ")}.
        </div>
      )}

      {churnDoMes.length > 0 && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{churnDoMes.length}</strong> cliente(s) cancelaram este mês: {churnDoMes.map((e) => e.nome).join(", ")}.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial até</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Desde</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{e.nome}</td>
                <td className="px-4 py-3 text-slate-600">{PLANO_LABEL[e.plano as Plano] ?? e.plano}</td>
                <td className="px-4 py-3">
                  <span className={e.status === "ativo" ? "badge-ativo" : "badge-inativo"}>
                    {STATUS_EMPRESA_LABEL[e.status as StatusEmpresa] ?? e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {e.trial_ends_at ? new Date(e.trial_ends_at).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{e.stripe_customer_id ? "Conectado" : "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.created_at ? new Date(e.created_at).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/assinatura?empresa=${e.id}`} className="text-frota-600 hover:underline">
                    Ver assinatura
                  </Link>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum cliente cadastrado ainda.
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
