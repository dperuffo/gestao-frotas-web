import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataBr } from "@/lib/utils";
import {
  PERIODOS_FINANCEIRO,
  PERIODO_FINANCEIRO_LABEL,
  resolverPeriodoFinanceiro,
  resolverJanelaPrevista,
  STATUS_FATURA_LABEL,
  statusFaturaExibicao,
  TIPO_DESPESA_POSTO_LABEL,
  FAIXAS_AGING,
  diasEmAtraso,
} from "@/lib/financeiroPostos";
import { resumoAjustesAbastecimentos } from "@/lib/ajustesAbastecimentos";
import { buscarCiclosAbertos, agruparCiclosPorContraparte } from "@/lib/ciclosAbertos";
import { SecaoAjustesAbastecimentos } from "../_components/SecaoAjustesAbastecimentos";
import { VisaoCiclosPorContraparte } from "../_components/VisaoCiclosPorContraparte";
import { LogoProvedor } from "@/components/LogoProvedor";
import { GraficoFluxoCaixaPosto, type PontoFluxoCaixaPosto } from "./_components/GraficoFluxoCaixaPosto";
import { FormularioDespesaPosto } from "./_components/FormularioDespesaPosto";
import { BotaoAcaoFinanceiraPosto } from "./_components/BotaoAcaoFinanceiraPosto";
import { SecaoDrePosto, type DrePostoDados } from "./_components/SecaoDrePosto";
// Fase Redesign-Telas-Densas / Backlog-Visao-Posto (13/08/2026) — mesmo
// toque visual já aplicado em /financeiro (lado cliente).
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Wallet, AlertTriangle, TrendingUp, TrendingDown, Receipt, CheckCircle2 } from "lucide-react";
import { marcarDespesaPagaAcao, excluirDespesaAcao } from "./actions";

type SearchParams = { empresa?: string; periodo?: string; inicio?: string; fim?: string };

// Fase 27.134/27.135 — pedido do Daniel: o "Consolidado por meio de
// pagamento" (Fase 27.133, em /financeiro) também precisa aparecer na
// visão do posto. Sem separar PróFrotas do resto, é um provedor igual aos
// demais na mesma lista/tabela.
// Fase Provedores-Logos — trocado o badge colorido de texto pelas logos
// reais dos provedores (componente LogoProvedor compartilhado), mesmo
// padrão já aplicado em /financeiro, /abastecimentos, /integracoes e
// /dashboard.

type FaturaRow = {
  id: string;
  empresa_cliente_id: string;
  cliente_nome: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  vencimento: string;
  valor_total: number;
  volume_total: number;
  status: string;
  pago_em: string | null;
};

type DespesaRow = {
  id: string;
  tipo: string;
  descricao: string | null;
  valor: number;
  competencia: string;
  vencimento: string;
  status: string;
  pago_em: string | null;
  recorrente: boolean;
};

// Fase 27.64 — Painel Financeiro do Posto: contas a receber (faturas,
// geradas automaticamente pelo robô a partir dos abastecimentos fornecidos,
// agrupados por negociação) e contas a pagar (despesas, lançadas
// manualmente). Tela exclusiva do segmento "Revenda" — o Painel Financeiro
// de Frota (custos/orçamento) continua em /financeiro, sem relação com este.
export default async function FinanceiroPostoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const {
    empresa: empresaParam,
    periodo: periodoParam,
    inicio: inicioParam,
    fim: fimParam,
  } = await searchParams;
  const supabase = await createClient();

  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }

  if (empresaSelecionada && segmentoSelecionado !== "Revenda") {
    return (
      <div className="card p-6 text-sm text-slate-600">
        Esta tela é exclusiva para postos revendedores. Para custos e orçamento da sua frota, use o{" "}
        <Link href="/financeiro" className="text-frota-600 hover:underline">
          Painel Financeiro
        </Link>
        .
      </div>
    );
  }

  const hojeIso = new Date().toISOString().slice(0, 10);
  const { periodo, inicio, fim } = resolverPeriodoFinanceiro(periodoParam, inicioParam, fimParam);
  // Fase 27.81 — janela separada, pra frente a partir de hoje, só pros
  // indicadores/gráfico PROSPECTIVOS (vencendo/previsto). Ver comentário em
  // resolverJanelaPrevista (financeiroPostos.ts) pro achado real.
  const { inicio: inicioPrevisto, fim: fimPrevisto } = resolverJanelaPrevista(periodo, inicio, fim, hojeIso);

  let faturas: FaturaRow[] = [];
  let despesas: DespesaRow[] = [];
  let erro: string | undefined;

  // Fase 27.134 — pedido do Daniel: trazer o "Consolidado por meio de
  // pagamento" (Fase 27.133, já em /financeiro) também pra visão do posto.
  // abastecimentos_unificado já traz posto_cnpj pros dois lados (pv_cnpj do
  // PróFrotas, posto_cnpj da Valecard/RedeFrota/TicketLog/Veloe) — filtra
  // pelo CNPJ do próprio posto, mesmo campo/comparação já usada em
  // AbastecimentosPosto.tsx. A leitura de abastecimentos_externos por
  // posto_cnpj só passou a funcionar nesta fase (nova policy RLS
  // abastecimentos_externos_select_posto — antes só existia RLS por
  // empresa_id, e o posto nunca é "membro" da empresa cliente).
  let indicadoresPorProvedor: { provedor: string; valorTotal: number; litros: number; qtdAbastecimentos: number }[] = [];
  if (empresaSelecionada && segmentoSelecionado === "Revenda") {
    const { data: empresaPosto } = await supabase.from("empresas").select("cnpj").eq("id", empresaSelecionada).maybeSingle();
    const meuCnpj = empresaPosto?.cnpj;
    if (meuCnpj) {
      const { data: unificadoRaw } = await supabase
        .from("abastecimentos_unificado")
        .select("provedor, valor_total, litros")
        .eq("posto_cnpj", meuCnpj)
        .gte("data_abastecimento", `${inicio}T00:00:00`)
        .lte("data_abastecimento", `${fim}T23:59:59`)
        .limit(50000);
      const porProvedor = new Map<string, { valorTotal: number; litros: number; qtdAbastecimentos: number }>();
      for (const r of (unificadoRaw ?? []) as { provedor: string; valor_total: number | null; litros: number | null }[]) {
        const atual = porProvedor.get(r.provedor) ?? { valorTotal: 0, litros: 0, qtdAbastecimentos: 0 };
        atual.valorTotal += r.valor_total ?? 0;
        atual.litros += r.litros ?? 0;
        atual.qtdAbastecimentos += 1;
        porProvedor.set(r.provedor, atual);
      }
      indicadoresPorProvedor = Array.from(porProvedor.entries())
        .map(([provedor, v]) => ({ provedor, ...v }))
        .sort((a, b) => b.valorTotal - a.valorTotal);
    }
  }

  // Fase 27.70 — pedido do Daniel: seção "Ajustes de abastecimento" também
  // no painel financeiro do posto.
  const JANELA_AJUSTES_DIAS = 30;
  const desdeAjustesIso = new Date(Date.now() - JANELA_AJUSTES_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const resumoAjustes =
    empresaSelecionada && segmentoSelecionado === "Revenda"
      ? await resumoAjustesAbastecimentos(supabase, {
          lado: "posto",
          empresaId: empresaSelecionada,
          desde: desdeAjustesIso,
        })
      : null;

  if (empresaSelecionada) {
    const [resultadoFaturas, resultadoDespesas] = await Promise.all([
      supabase
        .from("faturas_postos")
        .select(
          "id, empresa_cliente_id, cliente_nome, periodo_inicio, periodo_fim, vencimento, valor_total, volume_total, status, pago_em"
        )
        .eq("empresa_posto_id", empresaSelecionada)
        .order("vencimento", { ascending: false })
        .limit(500),
      supabase
        .from("despesas_postos")
        .select("id, tipo, descricao, valor, competencia, vencimento, status, pago_em, recorrente")
        .eq("empresa_posto_id", empresaSelecionada)
        .order("vencimento", { ascending: false })
        .limit(500),
    ]);

    if (resultadoFaturas.error) erro = resultadoFaturas.error.message;
    else if (resultadoDespesas.error) erro = resultadoDespesas.error.message;
    faturas = resultadoFaturas.data ?? [];
    despesas = resultadoDespesas.data ?? [];
  }

  // Fase 27.84 — pedido do Daniel: o ciclo ATUAL (ainda não fechado pelo
  // robô) não aparecia em nenhum painel financeiro, só depois de fechado.
  // ciclos_abertos_postos() já devolve só as negociações visíveis a este
  // usuário — filtra pelas do posto selecionado (RPC não recebe filtro,
  // devolve tudo que o usuário pode ver).
  const todosCiclosAbertos = empresaSelecionada ? await buscarCiclosAbertos(supabase) : [];
  const ciclosAbertosDoPosto = todosCiclosAbertos.filter((c) => c.empresa_posto_id === empresaSelecionada);

  // Fase DRE-Gerencial (26/07/2026) — DRE do posto no mesmo período (inicio/
  // fim, retrospectivo) já selecionado nesta tela. RPC dre_posto() roda com
  // a RLS de quem chama, mesmo padrão de indicadores_financeiros().
  let dre: DrePostoDados | null = null;
  if (empresaSelecionada && segmentoSelecionado === "Revenda") {
    const { data: dreData } = await supabase.rpc("dre_posto", {
      p_empresa_posto_id: empresaSelecionada,
      p_data_inicio: inicio,
      p_data_fim: fim,
    });
    dre = dreData?.[0] ?? null;
  }

  // Fase 27.85 — pedido do Daniel: "um posto pode ter muitos ciclos... com
  // muitos clientes" — a lista plana de faturas não escala. Busca as
  // negociações aceitas (base de clientes com relação ativa, mesmo os que
  // ainda não têm nenhuma fatura) pra montar 1 linha por cliente.
  const { data: negociacoesParaAgrupar } = empresaSelecionada
    ? await supabase
        .from("negociacoes_postos")
        .select("empresa_cliente_id, cliente_nome")
        .eq("empresa_posto_id", empresaSelecionada)
        .eq("status", "aceita")
    : { data: null };

  // Fase 27.108 — ciclo/prazo agora é atributo do CLIENTE (empresas), não
  // mais de cada negociação — busca à parte, pros clientes envolvidos.
  const idsClientes = [...new Set((negociacoesParaAgrupar ?? []).map((n) => n.empresa_cliente_id))];
  const { data: clientesCiclo } = idsClientes.length
    ? await supabase.from("empresas").select("id, ciclo_faturamento_dias").in("id", idsClientes)
    : { data: [] };
  const cicloPorCliente = new Map((clientesCiclo ?? []).map((c) => [c.id, c]));

  const ciclosAbertosPorCliente = new Map(ciclosAbertosDoPosto.map((c) => [c.empresa_cliente_id, c]));
  const linhasPorCliente = agruparCiclosPorContraparte({
    negociacoes: (negociacoesParaAgrupar ?? []).map((n) => ({
      contraparteId: n.empresa_cliente_id,
      contraparteNome: n.cliente_nome,
      cicloFaturamentoDias: cicloPorCliente.get(n.empresa_cliente_id)?.ciclo_faturamento_dias ?? 30,
    })),
    faturas: faturas.map((f) => ({
      contraparteId: f.empresa_cliente_id,
      contraparteNome: f.cliente_nome,
      status: f.status,
      vencimento: f.vencimento,
      valorTotal: f.valor_total,
    })),
    ciclosAbertosPorContraparte: ciclosAbertosPorCliente,
    hojeIso,
  });

  // KPIs
  // Fase 27.91 — pedido do Daniel: o ciclo em andamento (ainda não fechado
  // pelo robô) já representa valor devido pelos abastecimentos já feitos —
  // soma no "A receber (em aberto)" mesmo antes do robô gerar a fatura real.
  const aReceberAberto =
    faturas.filter((f) => f.status === "fechada" || f.status === "a_vencer").reduce((s, f) => s + f.valor_total, 0) +
    ciclosAbertosDoPosto.reduce((s, c) => s + c.valor_acumulado, 0);
  const vencido = faturas
    .filter((f) => f.status === "a_vencer" && f.vencimento < hojeIso)
    .reduce((s, f) => s + f.valor_total, 0);
  const recebidoNoPeriodo = faturas
    .filter((f) => f.status === "paga" && f.pago_em && f.pago_em.slice(0, 10) >= inicio && f.pago_em.slice(0, 10) <= fim)
    .reduce((s, f) => s + f.valor_total, 0);

  const aPagarAberto = despesas.filter((d) => d.status === "aberta").reduce((s, d) => s + d.valor, 0);
  const pagoNoPeriodo = despesas
    .filter((d) => d.status === "paga" && d.pago_em && d.pago_em.slice(0, 10) >= inicio && d.pago_em.slice(0, 10) <= fim)
    .reduce((s, d) => s + d.valor, 0);

  const aReceberVencendoNoPeriodo = faturas
    .filter((f) => f.status === "a_vencer" && f.vencimento >= inicioPrevisto && f.vencimento <= fimPrevisto)
    .reduce((s, f) => s + f.valor_total, 0);
  const aPagarVencendoNoPeriodo = despesas
    .filter((d) => d.status === "aberta" && d.vencimento >= inicioPrevisto && d.vencimento <= fimPrevisto)
    .reduce((s, d) => s + d.valor, 0);
  const saldoPrevistoPeriodo = aReceberVencendoNoPeriodo - aPagarVencendoNoPeriodo;

  // Aging (faturas vencidas, em aberto)
  const agingFaturas = FAIXAS_AGING.map((faixa) => {
    const linhas = faturas.filter((f) => {
      if (f.status !== "a_vencer" || f.vencimento >= hojeIso) return false;
      const dias = diasEmAtraso(f.vencimento, hojeIso);
      return dias >= faixa.min && dias <= faixa.max;
    });
    return { ...faixa, valor: linhas.reduce((s, f) => s + f.valor_total, 0), quantidade: linhas.length };
  });

  // Gráfico de fluxo de caixa: 1 barra por dia, pra frente a partir de hoje
  // (janela prevista, não a janela retrospectiva usada pra "recebido/pago").
  const dadosGrafico: PontoFluxoCaixaPosto[] = [];
  const cursor = new Date(inicioPrevisto + "T00:00:00Z");
  const fimData = new Date(fimPrevisto + "T00:00:00Z");
  while (cursor <= fimData) {
    const diaIso = cursor.toISOString().slice(0, 10);
    const aReceberDia = faturas
      .filter((f) => f.status === "a_vencer" && f.vencimento === diaIso)
      .reduce((s, f) => s + f.valor_total, 0);
    const aPagarDia = despesas
      .filter((d) => d.status === "aberta" && d.vencimento === diaIso)
      .reduce((s, d) => s + d.valor, 0);
    dadosGrafico.push({ diaLabel: formatarDataBr(diaIso), aReceber: aReceberDia, aPagar: aPagarDia });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Financeiro</h1>
          <p className="mt-1 text-sm text-slate-500">
            Contas a receber (faturas dos clientes) e contas a pagar (despesas do posto)
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
      </div>

      {/* Este seletor troca qual POSTO (empresa própria) está ativo — não é
          um filtro de "cliente" de terceiros. Mantém "Empresa"/"Trocar" em
          vez do padrão "Cliente"/"Filtrar" (mesmo raciocínio de
          clientes-posto/meu-posto). */}
      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Empresa</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Trocar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <>
          {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar dados financeiros: {erro}</p>}

          <div className="mb-4 flex flex-wrap gap-2">
            {PERIODOS_FINANCEIRO.map((p) => (
              <Link
                key={p}
                href={`/financeiro-posto?empresa=${empresaSelecionada}&periodo=${p}`}
                className={`rounded-full px-3 py-1 text-xs font-medium ${periodo === p ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {PERIODO_FINANCEIRO_LABEL[p]}
              </Link>
            ))}
          </div>
          {periodo === "personalizado" && (
            <form className="mb-4 flex items-end gap-2">
              <input type="hidden" name="empresa" value={empresaSelecionada} />
              <input type="hidden" name="periodo" value="personalizado" />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
                <input type="date" name="inicio" defaultValue={inicio} className="input text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
                <input type="date" name="fim" defaultValue={fim} className="input text-sm" />
              </div>
              <button type="submit" className="btn-secondary text-sm">
                Aplicar
              </button>
            </form>
          )}
          <p className="mb-4 text-xs text-slate-400">
            Período: {formatarDataBr(inicio)} – {formatarDataBr(fim)}
          </p>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <IndicadorColorido cor="sky" icon={Wallet} label="A receber (em aberto)" valor={formatarMoeda(aReceberAberto)} />
            <IndicadorColorido cor="red" icon={AlertTriangle} label="Vencido (inadimplência)" valor={formatarMoeda(vencido)} />
            <IndicadorColorido cor="green" icon={TrendingUp} label="Recebido no período" valor={formatarMoeda(recebidoNoPeriodo)} />
            <IndicadorColorido cor="amber" icon={Receipt} label="A pagar (em aberto)" valor={formatarMoeda(aPagarAberto)} />
            <IndicadorColorido cor="green" icon={CheckCircle2} label="Pago no período" valor={formatarMoeda(pagoNoPeriodo)} />
            <IndicadorColorido
              cor={saldoPrevistoPeriodo < 0 ? "red" : "green"}
              icon={saldoPrevistoPeriodo < 0 ? TrendingDown : TrendingUp}
              label="Saldo previsto do período"
              valor={formatarMoeda(saldoPrevistoPeriodo)}
            />
          </div>

          {indicadoresPorProvedor.length > 0 && (
            <div className="card mb-6 overflow-x-auto p-6">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Consolidado por meio de pagamento</h2>
              <p className="mb-3 text-xs text-slate-500">
                Abastecimentos que você forneceu no período, por meio de pagamento usado pelo cliente. Só
                informativo — quem cobra o cliente por essas vendas é o próprio meio de pagamento (Ticket
                Log, Edenred, Veloe...), fora do FNI. O quadro &quot;Ciclos por cliente&quot; abaixo mostra
                só a cobrança que o FNI de fato calcula (negociação direta).
              </p>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Meio de pagamento</th>
                    <th className="py-2 pr-4">Abastecimentos</th>
                    <th className="py-2 pr-4">Litros</th>
                    <th className="py-2">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {indicadoresPorProvedor.map((p) => (
                    <tr key={p.provedor}>
                      <td className="py-2.5 pr-4">
                        <LogoProvedor provedor={p.provedor} className="h-5 w-auto" />
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{p.qtdAbastecimentos}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{p.litros.toLocaleString("pt-BR")}</td>
                      <td className="py-2.5 text-slate-600">{formatarMoeda(p.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dre && <SecaoDrePosto dados={dre} />}

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card p-4 lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-900">Fluxo de caixa previsto (vencimentos por dia)</h2>
              <p className="mb-3 text-xs text-slate-400">
                Previsão: {formatarDataBr(inicioPrevisto)} – {formatarDataBr(fimPrevisto)}
              </p>
              <GraficoFluxoCaixaPosto dados={dadosGrafico} />
            </div>
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Contas a receber vencidas, por atraso</h2>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1">Faixa</th>
                    <th className="py-1 text-right">Qtd.</th>
                    <th className="py-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agingFaturas.map((faixa) => (
                    <tr key={faixa.chave}>
                      <td className="py-1.5 text-slate-600">{faixa.label}</td>
                      <td className="py-1.5 text-right text-slate-500">{faixa.quantidade}</td>
                      <td className="py-1.5 text-right font-medium text-slate-700">{formatarMoeda(faixa.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <VisaoCiclosPorContraparte
            linhas={linhasPorCliente}
            rotulo="posto"
            hrefBase="/clientes-posto"
            empresaId={empresaSelecionada}
          />

          <div className="mb-6 card p-6">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Lançar despesa</h2>
            <p className="mb-4 text-xs text-slate-500">Contas a pagar do posto — compras, salários, impostos e outras despesas.</p>
            <FormularioDespesaPosto empresaPostoId={empresaSelecionada} />
          </div>

          <div className="card overflow-x-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Contas a pagar (despesas do posto)</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {despesas.map((d) => {
                  const statusExib = statusFaturaExibicao(d.status, d.vencimento, hojeIso);
                  return (
                    <tr key={d.id} className="transition-colors hover:bg-frota-50/60">
                      <td className="px-4 py-3 text-slate-700">{TIPO_DESPESA_POSTO_LABEL[d.tipo as keyof typeof TIPO_DESPESA_POSTO_LABEL] ?? d.tipo}</td>
                      <td className="px-4 py-3 text-slate-500">{d.descricao ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatarDataBr(d.vencimento)}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{formatarMoeda(d.valor)}</td>
                      <td className="px-4 py-3">
                        <BadgeStatus status={statusExib} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {d.status === "aberta" && (
                          <div className="flex justify-end gap-3">
                            <BotaoAcaoFinanceiraPosto id={d.id} acao={marcarDespesaPagaAcao} rotulo="Marcar como paga" />
                            <BotaoAcaoFinanceiraPosto id={d.id} acao={excluirDespesaAcao} rotulo="Excluir" variante="danger" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {despesas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma despesa lançada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {resumoAjustes && (
            <div className="mt-6">
              <SecaoAjustesAbastecimentos
                pendentes={resumoAjustes.pendentes}
                aceitosNoPeriodo={resumoAjustes.aceitosNoPeriodo}
                impactoFinanceiro={resumoAjustes.impactoFinanceiro}
                ultimosAjustes={resumoAjustes.ultimosAjustes}
                diasPeriodo={JANELA_AJUSTES_DIAS}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).

function BadgeStatus({ status }: { status: keyof typeof STATUS_FATURA_LABEL }) {
  const cores: Record<string, string> = {
    aberta: "bg-slate-100 text-slate-700",
    vencida: "bg-red-100 text-red-700",
    paga: "bg-green-100 text-green-700",
    cancelada: "bg-slate-100 text-slate-400 line-through",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cores[status] ?? "bg-slate-100 text-slate-700"}`}>
      {STATUS_FATURA_LABEL[status]}
    </span>
  );
}
