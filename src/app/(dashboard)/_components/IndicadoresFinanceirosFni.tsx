import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLANO_LABEL, STATUS_EMPRESA_LABEL, type Plano, type StatusEmpresa } from "@/lib/constants";
import { buscarPrecosPlanos } from "@/lib/planosPrecos";
// Fase Redesign-Telas-Densas / Backlog-Visao-Admin (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import {
  Building2,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Wallet,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Percent,
} from "lucide-react";

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

  const [{ data: empresas, error }, precos, { data: invoicesDoMes }, { data: ultimosLogins }, { data: adocaoFuncionalidades }] =
    await Promise.all([
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
      // Fase Fidelizacao-Clientes-FNI — último login (por empresa, entre todos
      // os usuários vinculados via `usuarios_empresas`), vindo de
      // `auth.users.last_sign_in_at` — schema não acessível via client comum,
      // exposto pela RPC SECURITY DEFINER ultimo_login_por_empresa() (checa
      // perfil_usuario_atual() = 'admin' internamente; não-admin recebe lista
      // vazia). Usado pro indicador de saúde por inatividade e pra achar
      // trials mortos.
      supabase.rpc("ultimo_login_por_empresa"),
      // Fase Fidelizacao-Clientes-FNI — adoção de funcionalidades-chave por
      // empresa nos últimos 90 dias (roteirização, inteligência de rede,
      // notas fiscais, fretes, central de ações sugeridas), via EXISTS
      // direto nas tabelas de cada módulo — RPC SECURITY DEFINER
      // adocao_funcionalidades_por_empresa() (mesmo padrão admin-only de
      // ultimo_login_por_empresa). Usado no score de saúde da conta abaixo.
      supabase.rpc("adocao_funcionalidades_por_empresa", { p_dias: 90 }),
    ]);

  const lista = empresas ?? [];

  const ultimoLoginPorEmpresa = new Map<string, string | null>(
    (ultimosLogins ?? []).map((u) => [u.empresa_id, u.ultimo_login])
  );

  const adocaoPorEmpresa = new Map<string, number>(
    (adocaoFuncionalidades ?? []).map((a) => [a.empresa_id, Number(a.percentual_adocao)])
  );

  function diasDesde(dataIso: string) {
    return Math.floor((Date.now() - new Date(dataIso).getTime()) / 86400000);
  }

  // Trials mortos: status ainda "trial", trial já venceu, e nenhum login
  // registrado depois do vencimento (ou nenhum login desde sempre) — sinal
  // de que a empresa nunca converteu nem voltou a acessar o sistema, e
  // ninguém marcou como cancelada. Achado real (ambiente de teste): 2 contas
  // nessa situação, vencidas há 40-59 dias.
  const trialsMortos = lista
    .filter((e) => e.status === "trial" && e.trial_ends_at && new Date(e.trial_ends_at).getTime() < Date.now())
    .filter((e) => {
      const ultimoLogin = ultimoLoginPorEmpresa.get(e.id);
      return !ultimoLogin || new Date(ultimoLogin).getTime() < new Date(e.trial_ends_at as string).getTime();
    })
    .map((e) => ({
      ...e,
      diasVencido: diasDesde(e.trial_ends_at as string),
      ultimoLogin: ultimoLoginPorEmpresa.get(e.id) ?? null,
    }))
    .sort((a, b) => b.diasVencido - a.diasVencido);

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

  // Empresas com fatura "falhou" no mês corrente — reaproveitado pro sinal
  // de "situação de pagamento" do score de saúde abaixo (mesma fonte que já
  // alimenta o indicador de inadimplência do mês, acima).
  const empresasComFaturaEmAtraso = new Set(invoicesFalhas.map((i) => i.empresa_id));

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

  // Fase Fidelizacao-Clientes-FNI — Health Score composto (0-100), só pra
  // empresas "ativo" (mesmo recorte do indicador de inatividade acima).
  // Combina 3 sinais já calculados nesta tela / na RPC nova, sem precisar de
  // mais uma RPC nem de tabela nova:
  //
  //  (a) Recência de login — até 40 pontos, decaindo linearmente de 40 (≤7
  //      dias sem logar) até 0 (≥30 dias sem logar); nunca logou = 0. Peso
  //      mais alto dos 3 porque é o sinal mais direto de abandono (mesmo
  //      critério já usado no semáforo de inatividade da tabela).
  //  (b) Adoção de funcionalidades — até 40 pontos, proporcional ao
  //      `percentual_adocao` da RPC adocao_funcionalidades_por_empresa
  //      (0-100% de 5 módulos usados nos últimos 90 dias). Mesmo peso da
  //      recência de login: cliente pode logar sem realmente USAR o
  //      produto, e vice-versa — os dois sinais se complementam.
  //  (c) Situação de pagamento — 20 pontos se não há fatura "falhou" no mês
  //      corrente (mesmo Set `empresasComFaturaEmAtraso` que já alimenta o
  //      indicador de inadimplência do mês acima), 0 caso haja. Peso menor
  //      porque é um sinal binário e de curto prazo (1 mês), não um
  //      histórico de comportamento como (a) e (b).
  function pontosRecenciaLogin(diasSemLogin: number | null): number {
    if (diasSemLogin === null) return 0;
    if (diasSemLogin <= 7) return 40;
    if (diasSemLogin >= 30) return 0;
    return Math.round((40 * (30 - diasSemLogin)) / (30 - 7));
  }

  function pontosAdocao(percentualAdocao: number | undefined): number {
    if (percentualAdocao === undefined || Number.isNaN(percentualAdocao)) return 0;
    return Math.round((percentualAdocao / 100) * 40);
  }

  function pontosPagamento(empresaId: string): number {
    return empresasComFaturaEmAtraso.has(empresaId) ? 0 : 20;
  }

  function calcularHealthScore(empresaId: string): number {
    const ultimoLogin = ultimoLoginPorEmpresa.get(empresaId) ?? null;
    const diasSemLogin = ultimoLogin ? diasDesde(ultimoLogin) : null;
    return (
      pontosRecenciaLogin(diasSemLogin) +
      pontosAdocao(adocaoPorEmpresa.get(empresaId)) +
      pontosPagamento(empresaId)
    );
  }

  function corHealthScore(score: number): string {
    if (score >= 70) return "badge-ativo";
    if (score >= 40) return "badge-atencao";
    return "badge-inativo";
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar empresas: {error.message}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <IndicadorColorido cor="sky" icon={Building2} label="Total de clientes" valor={String(totalClientes)} />
        <IndicadorColorido cor="amber" icon={Clock} label="Em trial" valor={String(totalTrial)} />
        <IndicadorColorido cor="green" icon={CheckCircle2} label="Ativos" valor={String(totalAtivos)} />
        <IndicadorColorido cor="amber" icon={PauseCircle} label="Suspensos" valor={String(totalSuspensos)} />
        <IndicadorColorido cor="red" icon={XCircle} label="Cancelados" valor={String(totalCancelados)} />
        <IndicadorColorido cor="violet" icon={Wallet} label="MRR estimado" valor={formatarMoeda(mrrCents)} />
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Faturamento — {agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      </p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <IndicadorColorido cor="green" icon={TrendingUp} label="Faturado no mês" valor={formatarMoeda(faturamentoMesCents)} />
        <IndicadorColorido
          cor={invoicesFalhas.length > 0 ? "red" : "green"}
          icon={AlertTriangle}
          label="Inadimplência no mês"
          valor={`${formatarMoeda(inadimplenciaMesCents)} (${invoicesFalhas.length})`}
        />
        <IndicadorColorido
          cor={novosAssinantesDoMes.length > 0 ? "green" : "sky"}
          icon={UserPlus}
          label="Novos assinantes"
          valor={String(novosAssinantesDoMes.length)}
        />
        <IndicadorColorido
          cor={churnDoMes.length > 0 ? "red" : "green"}
          icon={UserMinus}
          label="Churn (cancelados)"
          valor={String(churnDoMes.length)}
        />
      </div>

      <div className="mb-6">
        <IndicadorColorido cor="sky" icon={Percent} label="Taxa de conversão (ativos / total)" valor={`${taxaConversao}%`} />
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

      {/* Fase Fidelizacao-Clientes-FNI — separado visualmente do aviso de
          trials expirando em ≤3 dias (aquele é sobre o FUTURO, este é sobre
          contas já vencidas e abandonadas no PASSADO: trial acabou e ninguém
          voltou a logar, mas o status nunca foi atualizado pra cancelado). */}
      {trialsMortos.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          <p className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
            {trialsMortos.length} trial(s) morto(s) — vencido(s) e nunca convertido(s)
          </p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Status ainda "trial", trial já venceu e não há login registrado depois do vencimento. Provável
            abandono — status nunca foi atualizado pra cancelado.
          </p>
          <ul className="space-y-1.5">
            {trialsMortos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">{e.nome}</span>
                <span className="badge-inativo">Venceu há {e.diasVencido} dia(s)</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Último login: {e.ultimoLogin ? new Date(e.ultimoLogin).toLocaleDateString("pt-BR") : "nunca logou"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial até</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Desde</th>
              <th className="px-4 py-3">Último login</th>
              <th className="px-4 py-3">Saúde da conta</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {lista.map((e) => {
              // Fase Fidelizacao-Clientes-FNI — indicador de saúde por
              // inatividade, só pra quem está "ativo" (trial/suspenso/
              // cancelado têm seus próprios sinais — trial morto tem seção
              // dedicada acima; suspenso/cancelado não precisam do mesmo
              // alerta de "sumiu sem avisar"). Semáforo: ≤7 dias verde,
              // 8–14 âmbar, >14 vermelho — mesmas classes badge-ativo/
              // badge-atencao/badge-inativo já usadas no resto do app.
              const ultimoLogin = ultimoLoginPorEmpresa.get(e.id) ?? null;
              const diasSemLogin = ultimoLogin ? diasDesde(ultimoLogin) : null;
              const corSaude =
                diasSemLogin === null ? "badge-inativo" : diasSemLogin <= 7 ? "badge-ativo" : diasSemLogin <= 14 ? "badge-atencao" : "badge-inativo";

              return (
                <tr key={e.id} className="transition-colors hover:bg-frota-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{e.nome}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{PLANO_LABEL[e.plano as Plano] ?? e.plano}</td>
                  <td className="px-4 py-3">
                    <span className={e.status === "ativo" ? "badge-ativo" : "badge-inativo"}>
                      {STATUS_EMPRESA_LABEL[e.status as StatusEmpresa] ?? e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {e.trial_ends_at ? new Date(e.trial_ends_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.stripe_customer_id ? "Conectado" : "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {e.created_at ? new Date(e.created_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {e.status === "ativo" ? (
                      <span className={corSaude}>
                        {diasSemLogin === null ? "Nunca logou" : `${diasSemLogin} dia(s)`}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.status === "ativo" ? (
                      <span className={corHealthScore(calcularHealthScore(e.id))}>
                        {calcularHealthScore(e.id)}/100
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/assinatura?empresa=${e.id}`} className="text-frota-600 hover:underline">
                      Ver assinatura
                    </Link>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
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

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
