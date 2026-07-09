import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import {
  formatarMoeda,
  formatarMesAnoSemFuso,
  NOMES_MES,
  type CategoriaOrcamento,
} from "@/lib/financeiro";
import { resumoAjustesAbastecimentos } from "@/lib/ajustesAbastecimentos";
import { buscarCiclosAbertos, agruparCiclosPorContraparte } from "@/lib/ciclosAbertos";
import { SecaoAjustesAbastecimentos } from "../_components/SecaoAjustesAbastecimentos";
import { IndicadoresFinanceirosFni } from "../_components/IndicadoresFinanceirosFni";
import { CobrancaEmAberto, type FaturaCobranca } from "./_components/CobrancaEmAberto";
import { GraficoEvolucaoFinanceira, type PontoFinanceiro } from "./_components/GraficoEvolucaoFinanceira";
import { FormularioOrcamento } from "./_components/FormularioOrcamento";
import { FormularioCustoFixo } from "./_components/FormularioCustoFixo";
import { TabelaOrcamento, type LinhaOrcamento } from "./_components/TabelaOrcamento";
import { TabelaCustosFixos, type LinhaCustoFixo } from "./_components/TabelaCustosFixos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

type SearchParams = { empresa?: string };

// Painel Financeiro do cliente (Fase 22): consolida o que já existia
// espalhado (custo de combustível e manutenção, já rastreados desde as
// Fases 3/8/9) com o que era novo — custos fixos (seguro, IPVA,
// licenciamento, rastreamento, multas) e orçamento planejado por mês. O
// detalhamento por centro de custo já existe no Dashboard (seção "Por
// Centro de Custo", Fase 8) — aqui só linkamos pra lá em vez de duplicar.
export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, perfil } = await resolverEmpresaAtual(supabase, empresaParam);
  const ehAdmin = perfil === "admin";

  const agora = new Date();
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const seisMesesAtras = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  const paraISO = (d: Date) => d.toISOString().slice(0, 10);

  // Fase 27.70 — pedido do Daniel: seção "Ajustes de abastecimento" também
  // no painel financeiro do cliente (impacto financeiro dos ajustes aceitos
  // é justamente um indicador financeiro).
  const JANELA_AJUSTES_DIAS = 30;
  const desdeAjustesIso = new Date(Date.now() - JANELA_AJUSTES_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const resumoAjustes = empresaSelecionada
    ? await resumoAjustesAbastecimentos(supabase, {
        lado: "cliente",
        empresaId: empresaSelecionada,
        desde: desdeAjustesIso,
      })
    : null;

  // Fase 27.75 — pedido do Daniel: painel financeiro do cliente precisa
  // mostrar a "cobrança em aberto" — faturas emitidas pelos postos com quem
  // negociou (faturas_postos.empresa_cliente_id), cruzando TODOS os postos.
  // Nome do posto resolvido via negociacoes_postos (mesmo truque das Fases
  // 27.71/27.72 — faturas_postos não denormaliza nome do posto, e um join
  // direto em `empresas` esbarraria na mesma RLS cross-tenant da Fase 27.68).
  let faturasCobranca: FaturaCobranca[] = [];
  let negociacoesDoCliente: {
    empresa_posto_id: string;
    posto_nome: string | null;
    status: string;
    ciclo_faturamento_dias: number;
    prazo_vencimento_dias: number;
  }[] = [];
  if (empresaSelecionada) {
    const [{ data: negociacoesData }, { data: faturasData }] = await Promise.all([
      supabase
        .from("negociacoes_postos")
        .select("empresa_posto_id, posto_nome, status, ciclo_faturamento_dias, prazo_vencimento_dias")
        .eq("empresa_cliente_id", empresaSelecionada),
      supabase
        .from("faturas_postos")
        .select("id, empresa_posto_id, periodo_inicio, periodo_fim, vencimento, valor_total, status")
        .eq("empresa_cliente_id", empresaSelecionada)
        .order("vencimento", { ascending: false })
        .limit(200),
    ]);
    negociacoesDoCliente = (negociacoesData ?? []).filter(
      (n): n is typeof n & { empresa_posto_id: string } => n.empresa_posto_id !== null
    );
    const nomePorPostoId = new Map(negociacoesDoCliente.map((n) => [n.empresa_posto_id, n.posto_nome]));
    faturasCobranca = (faturasData ?? []).map((f) => ({
      ...f,
      posto_nome: nomePorPostoId.get(f.empresa_posto_id) ?? null,
    }));
  }

  // Fase 27.84 — pedido do Daniel: o ciclo ATUAL (ainda não fechado pelo
  // robô) não aparecia em nenhum painel financeiro, só depois de fechado.
  const todosCiclosAbertos = empresaSelecionada ? await buscarCiclosAbertos(supabase) : [];
  const ciclosAbertosDoCliente = todosCiclosAbertos.filter((c) => c.empresa_cliente_id === empresaSelecionada);

  // Fase 27.85 — pedido do Daniel: mesmo agrupamento por contraparte do
  // lado do posto, agora do lado do cliente (agrupado por POSTO).
  const ciclosAbertosPorPosto = new Map(ciclosAbertosDoCliente.map((c) => [c.empresa_posto_id, c]));
  const linhasPorPosto = agruparCiclosPorContraparte({
    negociacoes: negociacoesDoCliente
      .filter((n) => n.status === "aceita")
      .map((n) => ({
        contraparteId: n.empresa_posto_id,
        contraparteNome: n.posto_nome,
        cicloFaturamentoDias: n.ciclo_faturamento_dias,
        prazoVencimentoDias: n.prazo_vencimento_dias,
      })),
    faturas: faturasCobranca.map((f) => ({
      contraparteId: f.empresa_posto_id,
      contraparteNome: f.posto_nome,
      status: f.status,
      vencimento: f.vencimento,
      valorTotal: f.valor_total,
    })),
    ciclosAbertosPorContraparte: ciclosAbertosPorPosto,
    hojeIso: paraISO(agora),
  });

  let indicadores: {
    custo_combustivel: number;
    litros_abastecidos: number;
    km_rodado: number;
    custo_manutencao: number;
    custo_fixos: number;
    custo_total: number;
    custo_por_km: number | null;
    orcamento_planejado: number;
  } | null = null;
  let evolucao: PontoFinanceiro[] = [];
  let centrosCusto: { id: string; nome: string }[] = [];
  let ultimosCustosFixos: {
    id: string;
    tipo: string;
    valor: number;
    competencia: string;
    descricao: string | null;
    placa: string | null;
    centro_custo_id: string | null;
    origem: string;
  }[] = [];
  let orcamentosDoMes: {
    id: string;
    categoria: string;
    valor_planejado: number;
    centro_custo_id: string | null;
  }[] = [];
  let indicadoresPorCentro: {
    centro_custo_id: string;
    centro_custo_nome: string;
    custo_combustivel: number;
    custo_manutencao: number;
    custo_fixos: number;
  }[] = [];

  if (empresaSelecionada) {
    const [
      { data: indicadoresData },
      { data: evolucaoData },
      { data: centrosCustoData },
      { data: custosFixosData },
      { data: orcamentosData },
      { data: indicadoresPorCentroData },
    ] = await Promise.all([
        supabase
          .rpc("indicadores_financeiros", {
            p_empresa_id: empresaSelecionada,
            p_data_inicio: paraISO(inicioMesAtual),
            p_data_fim: paraISO(fimMesAtual),
          })
          .single(),
        supabase.rpc("indicadores_financeiros_evolucao", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: paraISO(seisMesesAtras),
          p_data_fim: paraISO(fimMesAtual),
        }),
        supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaSelecionada).order("nome"),
        supabase
          .from("custos_fixos")
          .select("id, tipo, valor, competencia, descricao, placa, centro_custo_id, origem")
          .eq("empresa_id", empresaSelecionada)
          .order("competencia", { ascending: false })
          .limit(10),
        supabase
          .from("orcamentos")
          .select("id, categoria, valor_planejado, centro_custo_id")
          .eq("empresa_id", empresaSelecionada)
          .eq("ano", agora.getFullYear())
          .eq("mes", agora.getMonth() + 1),
        // Mesmo período do indicador do mês (não os 6 meses da evolução) —
        // precisa bater com o mês do orçamento pra "Realizado" fazer sentido.
        supabase.rpc("indicadores_financeiros_por_centro_custo", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: paraISO(inicioMesAtual),
          p_data_fim: paraISO(fimMesAtual),
        }),
      ]);

    indicadores = indicadoresData;
    evolucao = (evolucaoData ?? []).map((p) => ({
      mes: formatarMesAnoSemFuso(p.mes),
      combustivel: p.custo_combustivel,
      manutencao: p.custo_manutencao,
      custosFixos: p.custo_fixos,
    }));
    centrosCusto = centrosCustoData ?? [];
    ultimosCustosFixos = custosFixosData ?? [];
    orcamentosDoMes = orcamentosData ?? [];
    indicadoresPorCentro = indicadoresPorCentroData ?? [];
  }

  // Orçamento "geral" (sem centro de custo — vale pra frota inteira) compara
  // com o total da empresa; orçamento de um centro de custo específico
  // precisa comparar com o realizado DAQUELE centro, não da empresa toda —
  // por isso o mapa abaixo é por centro_custo_id, e "geral" usa os
  // indicadores gerais (indicadores, já filtrados por empresa/mês).
  const realizadoPorCategoria: Record<CategoriaOrcamento, number> = {
    geral: indicadores?.custo_total ?? 0,
    combustivel: indicadores?.custo_combustivel ?? 0,
    manutencao: indicadores?.custo_manutencao ?? 0,
    custos_fixos: indicadores?.custo_fixos ?? 0,
  };

  const realizadoPorCentro: Record<string, Record<CategoriaOrcamento, number>> = {};
  for (const c of indicadoresPorCentro) {
    realizadoPorCentro[c.centro_custo_id] = {
      geral: c.custo_combustivel + c.custo_manutencao + c.custo_fixos,
      combustivel: c.custo_combustivel,
      manutencao: c.custo_manutencao,
      custos_fixos: c.custo_fixos,
    };
  }

  function nomeCentroCusto(centroCustoId: string | null): string {
    if (!centroCustoId) return "Frota inteira";
    return centrosCusto.find((c) => c.id === centroCustoId)?.nome ?? "—";
  }

  function realizadoDoOrcamento(o: { categoria: string; centro_custo_id: string | null }): number {
    const categoria = o.categoria as CategoriaOrcamento;
    if (o.centro_custo_id) return realizadoPorCentro[o.centro_custo_id]?.[categoria] ?? 0;
    return realizadoPorCategoria[categoria] ?? 0;
  }

  // Custo fixo só é editável/excluível se a competência cai no mês vigente
  // (pedido do Daniel — não mexer em lançamento de mês já fechado). Parse
  // manual da string "YYYY-MM-DD" pra evitar o bug de fuso horário já
  // corrigido na Fase 23.1 (new Date() em data sem hora desloca pro fuso
  // local, que pode "voltar" um dia/mês em UTC-3).
  function custoFixoEditavel(competenciaISO: string): boolean {
    const [ano, mes] = competenciaISO.slice(0, 10).split("-").map(Number);
    return ano === agora.getFullYear() && mes === agora.getMonth() + 1;
  }

  const linhasOrcamento: LinhaOrcamento[] = orcamentosDoMes.map((o) => ({
    id: o.id,
    centroCustoNome: nomeCentroCusto(o.centro_custo_id),
    categoria: o.categoria as CategoriaOrcamento,
    valorPlanejado: o.valor_planejado,
    realizado: realizadoDoOrcamento(o),
  }));

  const linhasCustosFixos: LinhaCustoFixo[] = ultimosCustosFixos.map((c) => ({
    id: c.id,
    tipo: c.tipo,
    valor: c.valor,
    competencia: c.competencia,
    descricao: c.descricao,
    placa: c.placa,
    centroCustoId: c.centro_custo_id,
    origem: c.origem,
    editavel: custoFixoEditavel(c.competencia),
  }));

  // Fase 27.78 — achado real (reportado pelo Daniel, print mostrando
  // "Selecione um cliente" pro usuário admin): o item de menu que o admin
  // usa é "Painel Financeiro" (aponta pra cá), mas esta tela sempre foi só
  // o painel de custo/orçamento de UM cliente selecionado — pro admin, sem
  // selecionar ninguém, isso não fazia sentido nenhum (ele não é "de" um
  // cliente). Os indicadores da FNI (MRR, faturamento, churn — Fase 27.73)
  // só existiam em /assinaturas, uma rota separada que o admin não
  // necessariamente sabe que existe. Agora, quando é admin E nenhum cliente
  // específico está selecionado, mostra os indicadores da FNI aqui mesmo —
  // se o admin selecionar um cliente no seletor, continua vendo o painel de
  // custo NORMAL daquele cliente (não perde a funcionalidade existente).
  const mostrarFni = ehAdmin && !empresaSelecionada;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Painel Financeiro</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mostrarFni
              ? "Indicadores financeiros da FNI — planos, cobrança e MRR. Selecione um cliente ao lado para ver o painel de custo dele."
              : `Custo de combustível, manutenção, custos fixos e orçamento — ${NOMES_MES[agora.getMonth()]}/${agora.getFullYear()}.`}
          </p>
        </div>
        {empresas.length > 1 && (
          <form className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
              <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input">
                <option value="">{ehAdmin ? "Indicadores da FNI" : "Nenhum selecionado"}</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              Selecionar
            </button>
          </form>
        )}
      </div>

      {mostrarFni && <IndicadoresFinanceirosFni />}

      {!ehAdmin && !empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver o painel financeiro dele.
        </p>
      )}

      {empresaSelecionada && indicadores && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador label="Custo total do mês" valor={formatarMoeda(indicadores.custo_total)} ajudaChave="financeiro.custo_total" />
            <Indicador
              label="Custo por km"
              valor={indicadores.custo_por_km != null ? formatarMoeda(indicadores.custo_por_km) : "—"}
              ajudaChave="financeiro.custo_por_km"
            />
            <Indicador label="Orçamento planejado" valor={formatarMoeda(indicadores.orcamento_planejado)} ajudaChave="financeiro.orcamento_planejado" />
            <Indicador
              label="Saldo do orçamento"
              valor={formatarMoeda(indicadores.orcamento_planejado - indicadores.custo_total)}
              destaque={indicadores.orcamento_planejado > 0 && indicadores.custo_total > indicadores.orcamento_planejado ? "negativo" : "positivo"}
              ajudaChave="financeiro.saldo_orcamento"
            />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Indicador label="Combustível" valor={formatarMoeda(indicadores.custo_combustivel)} ajudaChave="financeiro.combustivel" />
            <Indicador label="Manutenção" valor={formatarMoeda(indicadores.custo_manutencao)} ajudaChave="financeiro.manutencao" />
            <Indicador label="Custos fixos" valor={formatarMoeda(indicadores.custo_fixos)} ajudaChave="financeiro.custos_fixos" />
          </div>

          <div className="card mb-6 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                Evolução mensal (últimos 6 meses) <AjudaIcon chave="financeiro.evolucao_mensal" />
              </h2>
              <Link href={`/centros-custo?empresa=${empresaSelecionada}`} className="text-xs text-frota-600 hover:underline">
                Ver detalhamento por centro de custo →
              </Link>
            </div>
            <GraficoEvolucaoFinanceira dados={evolucao} />
          </div>

          <div className="card mb-6 flex items-center justify-between p-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Receita e custo por viagem planejada</h2>
              <p className="mt-1 text-xs text-slate-500">
                Orçamento (combustível, pedágios, diárias, manutenção) e receita de cada viagem, com margem
                estimada — ver em Planos de Viagem.
              </p>
            </div>
            <Link href={`/planos-viagem?empresa=${empresaSelecionada}`} className="btn-secondary shrink-0 text-sm">
              Ver Planos de Viagem →
            </Link>
          </div>

          {orcamentosDoMes.length > 0 && (
            <div className="card mb-6 overflow-x-auto p-6">
              <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                Orçamento do mês por categoria <AjudaIcon chave="financeiro.orcamento_por_categoria" />
              </h2>
              <TabelaOrcamento linhas={linhasOrcamento} />
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-6">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Planejar orçamento</h2>
              <FormularioOrcamento empresaId={empresaSelecionada} centrosCusto={centrosCusto} />
            </div>
            <div className="card p-6">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Lançar custo fixo</h2>
              <FormularioCustoFixo empresaId={empresaSelecionada} centrosCusto={centrosCusto} />
              <p className="mt-3 text-xs text-slate-400">
                Também dá pra receber esses custos automaticamente de um sistema externo (seguradora, ERP)
                — veja{" "}
                <Link href="/integracoes" className="text-frota-600 hover:underline">
                  Integrações
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="card overflow-x-auto p-6">
            <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              Últimos custos fixos lançados <AjudaIcon chave="financeiro.custos_fixos_lancados" />
            </h2>
            <TabelaCustosFixos linhas={linhasCustosFixos} />
          </div>

          <CobrancaEmAberto
            faturas={faturasCobranca}
            linhas={linhasPorPosto}
            empresaId={empresaSelecionada}
            ciclosAbertos={ciclosAbertosDoCliente}
          />

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

function Indicador({
  label,
  valor,
  destaque,
  ajudaChave,
}: {
  label: string;
  valor: string;
  destaque?: "positivo" | "negativo";
  ajudaChave?: string;
}) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${
          destaque === "negativo" ? "text-red-600" : destaque === "positivo" ? "text-green-700" : "text-slate-900"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
