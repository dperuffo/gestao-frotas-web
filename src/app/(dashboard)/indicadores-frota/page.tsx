import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda, formatarMesAnoSemFuso } from "@/lib/financeiro";
import { agregarVeiculos, veiculoParaExibicao, type VeiculoKpi, type KpisExibicao } from "@/lib/indicadoresFrota";
// Fase Redesign-Telas-Densas / Backlog-Visao-Admin (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app. Os gauges
// (GaugeIndicador) já têm identidade visual própria — só os 2 cards
// "planos" que restavam (veículo/sinistros) trocam pelo IndicadorColorido.
// AjudaIcon saiu daqui: a única chamada era dentro do Indicador() local
// removido abaixo — IndicadorColorido já importa o próprio AjudaIcon.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Truck, AlertTriangle } from "lucide-react";
import { TabelaComparacaoVeiculos } from "./_components/TabelaComparacaoVeiculos";
import { GaugeIndicador } from "./_components/GaugeIndicador";
import { GraficoComposicaoOtif, GraficoEvolucaoOperacional, type PontoEvolucaoOperacional } from "./_components/GraficoOperacionalFrota";
import { GraficoKmVazioRoi } from "./_components/GraficoKmVazioRoi";
import { GraficoIndicadoresVeiculos, type ItemRankingVeiculo } from "./_components/GraficoIndicadoresVeiculos";

type SearchParams = {
  empresa?: string;
  inicio?: string;
  fim?: string;
  veiculo?: string;
  tipoVeiculo?: string;
  modelo?: string;
};

function paraISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

type KpisFrotaResumo = {
  total_veiculos: number;
  dias_periodo: number;
  disponibilidade_pct: number | null;
  custo_operacional_total: number;
  cpk_operacional: number | null;
  media_km_l: number | null;
  utilizacao_pct: number | null;
  manutencao_nao_classificada_custo: number;
  pct_corretiva: number | null;
  itens_inspecionados: number;
  conformidade_pct: number | null;
  tmrnc_horas: number | null;
  total_sinistros: number;
  indice_sinistralidade: number | null;
};

// Fase KPIs-Operacionais (02/08/2026, pedido do Daniel: trazer indicadores
// logísticos de mercado — OTIF, OCT, avarias, reclamações, km vazio, ROI —
// pra plataforma). RPC kpis_operacionais_frota — independente do
// filtro de veículo/tipo/modelo acima (fretes não têm placa associada de
// forma confiável no schema), sempre calculada pra empresa inteira.
type KpisOperacionais = {
  fretes_concluidos_total: number;
  fretes_com_prazo_total: number;
  otif_pct: number | null;
  oct_horas_medio: number | null;
  indice_avarias_pct: number | null;
  indice_reclamacoes_pct: number | null;
  qtd_reentregas_devolucoes: number;
  km_total_frota: number;
  km_estimado_fretes: number | null;
  km_vazio_estimado_pct: number | null;
  valor_investido_frota: number;
  receita_bruta_fretes: number;
  custo_operacional_total: number;
  roi_frota_pct: number | null;
  otif_no_prazo: number;
  otif_atrasado: number;
  otif_com_ocorrencia: number;
};

// Fase Plano-Graficos (05/09/2026) — série mensal pro gráfico de evolução do
// bloco operacional (RPC kpis_operacionais_frota_evolucao).
type KpisOperacionaisEvolucaoLinha = {
  mes: string;
  otif_pct: number | null;
  oct_horas_medio: number | null;
  indice_avarias_pct: number | null;
  indice_reclamacoes_pct: number | null;
};

function resumoParaExibicao(k: KpisFrotaResumo): KpisExibicao {
  return {
    totalVeiculos: k.total_veiculos,
    diasPeriodo: k.dias_periodo,
    disponibilidadePct: k.disponibilidade_pct,
    cpkOperacional: k.cpk_operacional,
    mediaKmL: k.media_km_l,
    utilizacaoPct: k.utilizacao_pct,
    pctCorretiva: k.pct_corretiva,
    manutencaoNaoClassificadaCusto: k.manutencao_nao_classificada_custo,
    conformidadePct: k.conformidade_pct,
    itensInspecionados: k.itens_inspecionados,
    tmrncHoras: k.tmrnc_horas,
    totalSinistros: k.total_sinistros,
    indiceSinistralidade: k.indice_sinistralidade,
  };
}

// Fase Indicadores-da-Frota (30/07/2026) — pedido do Daniel a partir de um
// artigo sobre os "8 KPIs essenciais" de gestão de frotas. Fases A/B/C
// cobriram os 8 indicadores no agregado da frota inteira. Fase D (pedido:
// "colocar um filtro de seleção do veículo... escolher o veículo específico
// ou todos, ou também poder comparar veículos entre si... indicadores
// distintos por modelo, tipo de veículo") adiciona os filtros de veículo/
// tipo/modelo e a tabela de comparação — ver kpis_frota_por_veiculo
// (migração) e src/lib/indicadoresFrota.ts (reagregação de subconjuntos).
export default async function IndicadoresFrotaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const {
    empresa: empresaParam,
    inicio,
    fim,
    veiculo: veiculoParam,
    tipoVeiculo: tipoVeiculoParam,
    modelo: modeloParam,
  } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const agora = new Date();
  const inicioDefault = new Date(agora);
  inicioDefault.setDate(inicioDefault.getDate() - 90);
  const dataInicio = inicio || paraISO(inicioDefault);
  const dataFim = fim || paraISO(agora);
  const diasPeriodo = Math.max(1, Math.round((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / 86400000) + 1);

  const [
    { data: resumoRaw, error: erroResumo },
    { data: porVeiculoRaw, error: erroPorVeiculo },
    { data: operacionaisRaw, error: erroOperacionais },
    { data: evolucaoOperacionalRaw, error: erroEvolucaoOperacional },
  ] = empresaSelecionada
    ? await Promise.all([
        supabase.rpc("kpis_frota_resumo", { p_empresa_id: empresaSelecionada, p_data_inicio: dataInicio, p_data_fim: dataFim }),
        supabase.rpc("kpis_frota_por_veiculo", { p_empresa_id: empresaSelecionada, p_data_inicio: dataInicio, p_data_fim: dataFim }),
        supabase.rpc("kpis_operacionais_frota", { p_empresa_id: empresaSelecionada, p_data_inicio: dataInicio, p_data_fim: dataFim }),
        supabase.rpc("kpis_operacionais_frota_evolucao", { p_empresa_id: empresaSelecionada, p_data_inicio: dataInicio, p_data_fim: dataFim }),
      ])
    : [{ data: null, error: null }, { data: null, error: null }, { data: null, error: null }, { data: null, error: null }];

  const resumo = (Array.isArray(resumoRaw) ? resumoRaw[0] : resumoRaw) as KpisFrotaResumo | null | undefined;
  const veiculos = (porVeiculoRaw ?? []) as VeiculoKpi[];
  const operacionais = (Array.isArray(operacionaisRaw) ? operacionaisRaw[0] : operacionaisRaw) as KpisOperacionais | null | undefined;
  const evolucaoOperacional = (evolucaoOperacionalRaw ?? []) as KpisOperacionaisEvolucaoLinha[];
  const error = erroResumo ?? erroPorVeiculo ?? erroOperacionais ?? erroEvolucaoOperacional;

  const tiposDisponiveis = Array.from(new Set(veiculos.map((v) => v.tipo_veiculo).filter((v): v is string => Boolean(v)))).sort();
  const modelosDisponiveis = Array.from(new Set(veiculos.map((v) => v.modelo).filter((v): v is string => Boolean(v)))).sort();

  const veiculosFiltrados = veiculos.filter(
    (v) => (!tipoVeiculoParam || v.tipo_veiculo === tipoVeiculoParam) && (!modeloParam || v.modelo === modeloParam)
  );

  const veiculoSelecionado = veiculoParam ? veiculos.find((v) => v.placa === veiculoParam) : undefined;
  const filtroAtivo = Boolean(tipoVeiculoParam || modeloParam);

  // Fase Plano-Graficos (05/09/2026) — série mensal já formatada pro gráfico
  // de evolução operacional (rótulo "mmm/aa", sem fuso).
  const evolucaoOperacionalGrafico: PontoEvolucaoOperacional[] = evolucaoOperacional.map((p) => ({
    mes: formatarMesAnoSemFuso(p.mes),
    otifPct: p.otif_pct,
    octHoras: p.oct_horas_medio,
    avariasPct: p.indice_avarias_pct,
    reclamacoesPct: p.indice_reclamacoes_pct,
  }));

  // Fase Plano-Graficos (05/09/2026) — rankings dos veículos que mais
  // precisam de atenção em cada indicador + composição do custo de
  // manutenção, a partir de veiculosFiltrados (mesma lista já usada na
  // tabela de comparação). Só faz sentido comparar com 2+ veículos.
  const rankingsVeiculos = (() => {
    const topPiores = (
      valores: { placa: string; valor: number | null }[],
      ordem: "asc" | "desc"
    ): ItemRankingVeiculo[] =>
      valores
        .filter((v): v is { placa: string; valor: number } => v.valor !== null)
        .sort((a, b) => (ordem === "asc" ? a.valor - b.valor : b.valor - a.valor))
        .slice(0, 6);

    if (veiculoSelecionado || veiculosFiltrados.length < 2) {
      return {
        rankingDisponibilidade: [] as ItemRankingVeiculo[],
        rankingCpk: [] as ItemRankingVeiculo[],
        rankingConsumo: [] as ItemRankingVeiculo[],
        rankingUtilizacao: [] as ItemRankingVeiculo[],
        rankingConformidade: [] as ItemRankingVeiculo[],
        rankingTmrnc: [] as ItemRankingVeiculo[],
        rankingSinistros: [] as ItemRankingVeiculo[],
        composicaoManutencao: { preventiva: 0, corretiva: 0, naoClassificada: 0 },
      };
    }

    return {
      rankingDisponibilidade: topPiores(
        veiculosFiltrados.map((v) => ({ placa: v.placa, valor: v.disponibilidade_pct })),
        "asc"
      ),
      rankingCpk: topPiores(
        veiculosFiltrados.map((v) => ({ placa: v.placa, valor: v.cpk_operacional })),
        "desc"
      ),
      rankingConsumo: topPiores(
        veiculosFiltrados.map((v) => ({ placa: v.placa, valor: v.media_km_l })),
        "asc"
      ),
      rankingUtilizacao: topPiores(
        veiculosFiltrados.map((v) => ({ placa: v.placa, valor: v.utilizacao_pct })),
        "asc"
      ),
      rankingConformidade: topPiores(
        veiculosFiltrados
          .filter((v) => v.itens_inspecionados > 0)
          .map((v) => ({ placa: v.placa, valor: v.conformidade_pct })),
        "asc"
      ),
      rankingTmrnc: topPiores(
        veiculosFiltrados.map((v) => ({ placa: v.placa, valor: v.tmrnc_horas })),
        "desc"
      ),
      rankingSinistros: topPiores(
        veiculosFiltrados
          .filter((v) => v.total_sinistros > 0)
          .map((v) => ({ placa: v.placa, valor: v.total_sinistros })),
        "desc"
      ),
      composicaoManutencao: {
        preventiva: veiculosFiltrados.reduce((s, v) => s + v.manutencao_preventiva_custo, 0),
        corretiva: veiculosFiltrados.reduce((s, v) => s + v.manutencao_corretiva_custo, 0),
        naoClassificada: veiculosFiltrados.reduce((s, v) => s + v.manutencao_nao_classificada_custo, 0),
      },
    };
  })();

  let kpis: KpisExibicao | null = null;
  let contexto = "Frota inteira";
  if (veiculoSelecionado) {
    kpis = veiculoParaExibicao(veiculoSelecionado);
    contexto = `Veículo ${veiculoSelecionado.placa}`;
  } else if (filtroAtivo) {
    kpis = agregarVeiculos(veiculosFiltrados, diasPeriodo);
    contexto = `Frota filtrada (${veiculosFiltrados.length} veículo${veiculosFiltrados.length === 1 ? "" : "s"})`;
  } else if (resumo) {
    kpis = resumoParaExibicao(resumo);
    contexto = "Frota inteira";
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Indicadores da Frota</h1>
        <p className="mt-1 text-sm text-slate-500">
          Os principais KPIs de gestão de frota, calculados a partir dos dados já cadastrados — abastecimentos,
          manutenções e hodômetro. Filtre por veículo, tipo ou modelo, ou compare a frota inteira na tabela abaixo.
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
          <input type="date" name="inicio" defaultValue={dataInicio} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="fim" defaultValue={dataFim} className="input text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de veículo</label>
          <select name="tipoVeiculo" defaultValue={tipoVeiculoParam ?? ""} className="input text-sm">
            <option value="">Todos</option>
            {tiposDisponiveis.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Modelo</label>
          <select name="modelo" defaultValue={modeloParam ?? ""} className="input text-sm">
            <option value="">Todos</option>
            {modelosDisponiveis.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Veículo</label>
          <select name="veiculo" defaultValue={veiculoParam ?? ""} className="input text-sm">
            <option value="">Todos (agregado)</option>
            {veiculosFiltrados.map((v) => (
              <option key={v.placa} value={v.placa}>
                {v.placa}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver os indicadores da frota dele.
        </p>
      )}

      {empresaSelecionada && error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erro ao carregar: {error.message}</p>
      )}

      {empresaSelecionada && !error && kpis && (
        <>
          {/* Fase KPIs-Operacionais (02/08/2026, pedido do Daniel: "Indicadores
              operacionais vem antes de indicadores da frota") — bloco de
              Fretes/TMS movido pra cima do bloco de veículos (era o
              contrário antes). */}
          {operacionais && (
            <>
              <div className="mb-3 mt-2">
                <h2 className="text-sm font-semibold text-slate-900">Indicadores operacionais (Fretes/TMS)</h2>
                <p className="text-xs text-slate-500">
                  Calculados pra empresa inteira (não filtram por veículo/tipo/modelo, já que o frete não é
                  vinculado a uma placa específica no sistema).
                </p>
              </div>

              {operacionais.fretes_concluidos_total === 0 ? (
                <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Nenhum frete concluído neste período — os indicadores de OTIF, OCT, avarias e reclamações aparecem
                  assim que o primeiro frete for concluído em{" "}
                  <Link href="/fretes" className="underline">
                    Fretes
                  </Link>
                  .
                </div>
              ) : (
                // Fase Plano-Graficos (05/09/2026, pedido do Daniel: "os
                // antigos precisam ser removidos" quando o gráfico novo já
                // reflete a mesma informação) — OTIF, Km rodado vazio e ROI
                // da frota tiveram os gauges removidos daqui: viraram
                // GraficoComposicaoOtif e GraficoKmVazioRoi logo abaixo
                // (com o selo Crítico/Atenção/Bom preservado dentro deles).
                // OCT, avarias, reclamações e reentregas continuam como
                // gauge — só ganharam uma série de tendência mensal
                // (GraficoEvolucaoOperacional), não uma substituição.
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <GaugeIndicador
                    label="OCT (tempo de ciclo do pedido)"
                    valor={operacionais.oct_horas_medio}
                    min={0}
                    max={72}
                    invertido
                    zonaVermelha={48}
                    zonaVerde={24}
                    unidade="horas"
                  />
                  <GaugeIndicador
                    label="Índice de avarias"
                    valor={operacionais.indice_avarias_pct}
                    min={0}
                    max={20}
                    invertido
                    zonaVermelha={10}
                    zonaVerde={0}
                    unidade="percentual"
                  />
                  <GaugeIndicador
                    label="Índice de reclamações"
                    valor={operacionais.indice_reclamacoes_pct}
                    min={0}
                    max={30}
                    invertido
                    zonaVermelha={15}
                    zonaVerde={5}
                    unidade="percentual"
                  />
                  <GaugeIndicador
                    label="Reentregas e devoluções"
                    valor={operacionais.qtd_reentregas_devolucoes}
                    min={0}
                    max={10}
                    invertido
                    zonaVermelha={3}
                    zonaVerde={0}
                    unidade="numero"
                  />
                </div>
              )}

              {operacionais.km_vazio_estimado_pct !== null && (
                <p className="mb-6 text-xs text-slate-400">
                  Km rodado vazio é uma ESTIMATIVA (km total da frota via hodômetro menos o km estimado dos fretes
                  concluídos) — não é medição real de trecho com/sem carga, já que o sistema não tem rastreamento
                  contínuo (telemetria) hoje.
                </p>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <GraficoComposicaoOtif
                  otifPct={operacionais.otif_pct}
                  noPrazo={operacionais.otif_no_prazo}
                  atrasado={operacionais.otif_atrasado}
                  comOcorrencia={operacionais.otif_com_ocorrencia}
                />
                <GraficoEvolucaoOperacional dados={evolucaoOperacionalGrafico} />
              </div>

              <GraficoKmVazioRoi
                kmComCarga={Math.max(0, operacionais.km_total_frota - (operacionais.km_estimado_fretes ?? 0))}
                kmVazio={
                  operacionais.km_vazio_estimado_pct !== null
                    ? (operacionais.km_vazio_estimado_pct / 100) * operacionais.km_total_frota
                    : 0
                }
                kmVazioPct={operacionais.km_vazio_estimado_pct}
                receita={operacionais.receita_bruta_fretes}
                custo={operacionais.custo_operacional_total}
                investimento={operacionais.valor_investido_frota}
                roiPct={operacionais.roi_frota_pct}
              />
            </>
          )}

          <div className="mb-3 mt-2">
            <h2 className="text-sm font-semibold text-slate-900">Indicadores da frota (veículos)</h2>
          </div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">{contexto}</p>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <GaugeIndicador
              label="Índice de disponibilidade"
              valor={kpis.disponibilidadePct}
              min={0}
              max={100}
              zonaVermelha={70}
              zonaVerde={90}
              unidade="percentual"
              ajudaChave="indicadores_frota.disponibilidade"
            />
            <GaugeIndicador
              label="Custo por km (CPK operacional)"
              valor={kpis.cpkOperacional}
              min={0}
              max={5}
              invertido
              zonaVermelha={3}
              zonaVerde={1.5}
              unidade="moeda_por_km"
              ajudaChave="indicadores_frota.cpk"
            />
            <GaugeIndicador
              label="Consumo médio"
              valor={kpis.mediaKmL}
              min={0}
              max={12}
              zonaVermelha={3}
              zonaVerde={6}
              unidade="km_por_litro"
              ajudaChave="indicadores_frota.consumo"
            />
            <GaugeIndicador
              label="Taxa de utilização"
              valor={kpis.utilizacaoPct}
              min={0}
              max={100}
              zonaVermelha={50}
              zonaVerde={70}
              unidade="percentual"
              ajudaChave="indicadores_frota.utilizacao"
            />
            <GaugeIndicador
              label="Manutenção corretiva (% do custo)"
              valor={kpis.pctCorretiva}
              min={0}
              max={100}
              invertido
              zonaVermelha={40}
              zonaVerde={20}
              unidade="percentual"
              semValorTexto="Sem manutenção classificada"
              ajudaChave="indicadores_frota.corretiva"
            />
            <IndicadorColorido
              cor="sky"
              icon={Truck}
              label={veiculoSelecionado ? "Veículo" : "Veículos no filtro"}
              valor={veiculoSelecionado ? veiculoSelecionado.placa : String(kpis.totalVeiculos)}
            />
            <GaugeIndicador
              label="Taxa de conformidade (checklist)"
              valor={kpis.conformidadePct}
              min={0}
              max={100}
              zonaVermelha={70}
              zonaVerde={90}
              unidade="percentual"
              semValorTexto="Sem inspeções no período"
              ajudaChave="indicadores_frota.conformidade"
            />
            <GaugeIndicador
              label="Tempo médio de resolução (TMRNC)"
              valor={kpis.tmrncHoras}
              min={-24}
              max={72}
              invertido
              zonaVermelha={48}
              zonaVerde={24}
              unidade="horas"
              semValorTexto="Sem pendências resolvidas"
              ajudaChave="indicadores_frota.tmrnc"
            />
            {kpis.indiceSinistralidade !== null ? (
              <GaugeIndicador
                label="Índice de sinistralidade"
                valor={kpis.indiceSinistralidade}
                min={0}
                max={50}
                invertido
                zonaVermelha={25}
                zonaVerde={10}
                unidade="percentual"
                ajudaChave="indicadores_frota.sinistralidade"
              />
            ) : (
              <IndicadorColorido
                cor={kpis.totalSinistros > 0 ? "amber" : "green"}
                icon={AlertTriangle}
                label="Sinistros no período"
                valor={String(kpis.totalSinistros)}
                ajudaChave="indicadores_frota.sinistralidade"
              />
            )}
          </div>

          {kpis.manutencaoNaoClassificadaCusto > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚠️ {formatarMoeda(kpis.manutencaoNaoClassificadaCusto)} em manutenções deste período ainda não foram
              classificadas como Preventiva ou Corretiva — o indicador de manutenção corretiva acima considera só as
              já classificadas. Classifique as novas manutenções em{" "}
              <Link href="/manutencao-preditiva" className="underline">
                Manutenção Preditiva
              </Link>
              .
            </div>
          )}

          {kpis.itensInspecionados === 0 && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Nenhuma inspeção registrada neste período — a taxa de conformidade e o TMRNC aparecem assim que a
              primeira inspeção for feita em{" "}
              <Link href="/checklist-veiculos" className="underline">
                Checklist de Inspeção
              </Link>
              .
            </div>
          )}

          <GraficoIndicadoresVeiculos
            rankingDisponibilidade={rankingsVeiculos.rankingDisponibilidade}
            rankingCpk={rankingsVeiculos.rankingCpk}
            rankingConsumo={rankingsVeiculos.rankingConsumo}
            rankingUtilizacao={rankingsVeiculos.rankingUtilizacao}
            rankingConformidade={rankingsVeiculos.rankingConformidade}
            rankingTmrnc={rankingsVeiculos.rankingTmrnc}
            rankingSinistros={rankingsVeiculos.rankingSinistros}
            composicaoManutencao={rankingsVeiculos.composicaoManutencao}
          />

          <div className="mb-3 mt-2">
            <h2 className="text-sm font-semibold text-slate-900">Comparação entre veículos</h2>
            <p className="text-xs text-slate-500">
              Clique numa placa pra ver os indicadores só dela acima, ou num cabeçalho de coluna pra ordenar.
            </p>
          </div>
          <TabelaComparacaoVeiculos veiculos={veiculosFiltrados} placaSelecionada={veiculoParam} />
        </>
      )}
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
