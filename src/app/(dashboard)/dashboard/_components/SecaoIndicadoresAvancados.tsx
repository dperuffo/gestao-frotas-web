import { calcularPrevisaoConsumo } from "@/lib/previsaoConsumo";
import type { Database } from "@/types/database.types";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import GraficoVariacaoPrecosLazy from "./GraficoVariacaoPrecosLazy";
import GraficoPrevisaoConsumoLazy from "./GraficoPrevisaoConsumoLazy";
import GraficoEvolucaoPrecoMedioLazy from "./GraficoEvolucaoPrecoMedioLazy";
import GraficoEvolutivoPostosLazy, { type PontoEvolutivoPostos } from "./GraficoEvolutivoPostosLazy";
import GraficoTopPostosLazy from "./GraficoTopPostosLazy";
import GraficoEficienciaVeiculosLazy, { type ItemEficienciaVeiculo } from "./GraficoEficienciaVeiculosLazy";
import { RankingGasto, type ItemRankingGasto } from "./RankingGasto";
import { TabelaDesempenhoPorAtivo, type ItemDesempenhoAtivo } from "./TabelaDesempenhoPorAtivo";

// Indicadores avançados do Dashboard (painéis 1 a 9), separados da página pra
// carregarem em STREAMING: a página principal aparece sem esperar estas 7
// consultas; elas entram sob <Suspense> assim que ficam prontas. Antes, uma
// única consulta lenta travava a tela inteira (incidente de 27/11/2026).
type F = Database["public"]["Functions"];
type R<N extends keyof F> = { data: F[N]["Returns"] | null };
export type PromessaAvancados = Promise<
  [
    R<"indicador_variacao_precos">,
    R<"indicador_consumo_diario">,
    R<"indicador_padrao_dia_semana">,
    R<"indicador_volume_postos">,
    R<"indicador_ranking_veiculos">,
    R<"indicador_ranking_motoristas">,
    R<"desempenho_veiculos_grupo">,
    R<"cliente_saving_anp">,
    R<"cliente_mix_combustiveis">,
  ]
>;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function FallbackAvancados() {
  return (
    <div className="space-y-6" aria-busy="true">
      {[1, 2, 3].map((n) => (
        <div key={n} className="card p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-4 h-48 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
      <p className="text-center text-xs text-slate-400">Carregando indicadores avançados…</p>
    </div>
  );
}

export async function SecaoIndicadoresAvancados({
  promessa,
  paineisOcultos,
  opcoesMes,
  indAno,
  indMes,
  diasNoMes,
  diaAtual,
  isMesAtual,
  isMesFuturo,
  itensEficienciaVeiculos,
}: {
  promessa: PromessaAvancados;
  paineisOcultos: string[];
  opcoesMes: { ano: number; mes: number; label: string }[];
  indAno: number;
  indMes: number;
  diasNoMes: number;
  diaAtual: number;
  isMesAtual: boolean;
  isMesFuturo: boolean;
  itensEficienciaVeiculos: ItemEficienciaVeiculo[];
}) {
  const [
    { data: variacaoPrecos },
    { data: consumoDiario },
    { data: padraoDiaSemanaRows },
    { data: volumePostos },
    { data: rankingVeiculos },
    { data: rankingMotoristas },
    { data: desempenhoPorAtivo },
    { data: savingAnp },
    { data: mixCombustiveis },
  ] = await promessa;
  const paineisOcultosSet = new Set(paineisOcultos);

  // Indicador 2 — Previsão de consumo: dias reais + projeção calibrada por
  // dia da semana (só projeta se o mês selecionado for o atual e ainda
  // faltar dia pra terminar).
  const diasReaisMap = new Map<number, number>();
  const diasReaisValorMap = new Map<number, number>(); // dia do mês -> valor (R$) efetivamente gasto
  for (const d of consumoDiario ?? []) {
    const dia = new Date(`${d.dia}T00:00:00`).getDate();
    diasReaisMap.set(dia, d.litros ?? 0);
    diasReaisValorMap.set(dia, d.valor ?? 0);
  }
  const padraoDiaSemana: Record<number, number> = {};
  for (const p of padraoDiaSemanaRows ?? []) {
    padraoDiaSemana[p.dia_semana] = p.media_litros;
  }
  const dadosPrevisaoConsumo = calcularPrevisaoConsumo({
    diasReais: diasReaisMap,
    padraoDiaSemana,
    ano: indAno,
    mes: indMes,
    diasNoMes,
    diaAtual: isMesFuturo ? 0 : diaAtual,
    projetarRestante: isMesAtual,
  });
  const totalLitrosMes = Array.from(diasReaisMap.values()).reduce((s, v) => s + v, 0);
  const totalLitrosProjetado = dadosPrevisaoConsumo
    .filter((p) => p.tipo === "projetado")
    .reduce((s, p) => s + p.litros, 0);

  // Custo (R$) — reaproveita o mesmo padrão de "preço médio" já usado no
  // Indicador 3 logo abaixo (valor do dia / litros do dia, vindo da mesma
  // RPC indicador_consumo_diario), em vez de inventar uma nova fonte de
  // preço. Dias reais usam o valor efetivamente gasto (diasReaisValorMap);
  // dias projetados aplicam o preço médio do período (total gasto / total
  // litros já realizados no mês) sobre os litros projetados — mesma lógica
  // de "taxa-base calibrada pelos dias já ocorridos" do cálculo de litros,
  // só que para preço (sem sazonalidade de preço por dia da semana, que não
  // existe nos dados).
  const totalValorMes = Array.from(diasReaisValorMap.values()).reduce((s, v) => s + v, 0);
  const precoMedioMes = totalLitrosMes > 0 ? totalValorMes / totalLitrosMes : 0;
  const dadosPrevisaoConsumoComCusto = dadosPrevisaoConsumo.map((p) => {
    const dia = Number(p.diaLabel);
    const valor =
      p.tipo === "real" ? diasReaisValorMap.get(dia) ?? 0 : Math.round(p.litros * precoMedioMes * 100) / 100;
    return { ...p, valor };
  });
  const totalValorProjetado = dadosPrevisaoConsumoComCusto
    .filter((p) => p.tipo === "projetado")
    .reduce((s, p) => s + p.valor, 0);

  // Indicador 3 — Evolução do preço médio (R$/L) por dia, derivada da mesma
  // série de consumo diário (valor do dia / litros do dia).
  const dadosPrecoMedio = (consumoDiario ?? [])
    .filter((d) => (d.litros ?? 0) > 0)
    .map((d) => ({
      diaLabel: new Date(`${d.dia}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      precoMedio: d.valor / d.litros,
    }));

  // Indicadores 4 e 5 — evolutivo e ranking dos Top 5 postos por volume.
  //
  // Fase Correção-Gráfico-Evolutivo-Postos (achado do Daniel: "gráfico
  // estranho", linha cortando no meio e eixo X voltando pro início) — a RPC
  // indicador_volume_postos ordena por (posto_nome, dia), não por dia global
  // (cada posto pode ter uma faixa de dias diferente). O bug: o Map abaixo
  // era chaveado pelo diaLabel (string "DD/MM") na ordem em que as LINHAS
  // chegavam — então os dias do 1º posto (alfabético) entravam primeiro no
  // Map, e quando o 2º posto trazia um dia ainda não visto (ex.: um dia
  // anterior aos do 1º posto), ele era inserido no FIM da ordem de iteração
  // do Map, quebrando a ordem cronológica do eixo X. Corrigido chaveando
  // pelo v.dia (ISO "AAAA-MM-DD", ordenável lexicograficamente = ordenável
  // cronologicamente) e ordenando o array final antes de virar pontos do
  // gráfico.
  const postosNomes = Array.from(new Set((volumePostos ?? []).map((v) => v.posto_nome ?? v.posto_cnpj)));
  const porDiaPostos = new Map<string, PontoEvolutivoPostos>();
  const totalPorPosto = new Map<string, number>();
  for (const v of volumePostos ?? []) {
    const nome = v.posto_nome ?? v.posto_cnpj;
    const diaLabel = new Date(`${v.dia}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const ponto = porDiaPostos.get(v.dia) ?? { diaLabel };
    ponto[nome] = v.litros;
    porDiaPostos.set(v.dia, ponto);
    totalPorPosto.set(nome, (totalPorPosto.get(nome) ?? 0) + v.litros);
  }
  const dadosEvolutivoPostos = Array.from(porDiaPostos.entries())
    .sort(([diaA], [diaB]) => diaA.localeCompare(diaB))
    .map(([, ponto]) => ponto);
  const dadosTopPostos = Array.from(totalPorPosto.entries())
    .map(([posto, litros]) => ({ posto, litros: Math.round(litros * 10) / 10 }))
    .sort((a, b) => b.litros - a.litros);

  // Indicadores 6 e 7 — ranking de veículos e motoristas por gasto.
  const itensRankingVeiculos: ItemRankingGasto[] = (rankingVeiculos ?? []).map((v) => ({
    chave: v.placa,
    label: v.placa,
    sub: [v.marca, v.modelo].filter(Boolean).join(" ") || null,
    gasto: v.gasto_total,
    litros: v.litros_total,
    qtd: v.qtd_abastecimentos,
  }));
  const itensRankingMotoristas: ItemRankingGasto[] = (rankingMotoristas ?? []).map((m) => ({
    chave: m.motorista_nome,
    label: m.motorista_nome,
    gasto: m.gasto_total,
    litros: m.litros_total,
    qtd: m.qtd_abastecimentos,
  }));

  // Indicador 9 — Desempenho por marca/modelo/motor (agregado, não por
  // placa individual, ver TabelaDesempenhoPorAtivo).
  const itensDesempenhoPorAtivo: ItemDesempenhoAtivo[] = (desempenhoPorAtivo ?? []).map((d) => ({
    marca: d.marca,
    modelo: d.modelo,
    motor: d.motor,
    qtdVeiculos: d.qtd_veiculos,
    kmTotal: d.km_total,
    litrosTotal: d.litros_total,
    mediaKmL: d.media_km_l,
    precoMedioLitro: d.preco_medio_litro,
    custoCombustivelTotal: d.custo_combustivel_total,
    tcoTotal: d.tco_total,
    custoPorKm: d.custo_por_km,
    scoreManutencaoMedio: d.score_manutencao_medio,
    qtdCriticos: d.qtd_criticos,
  }));

  // ---- Painel 10: preço pago vs. referência ANP (mês selecionado + 6 meses) ----
  const NOME_CATEGORIA: Record<string, string> = {
    "GASOLINA COMUM": "Gasolina comum",
    "GASOLINA ADITIVADA": "Gasolina aditivada / alta octanagem",
    "ETANOL HIDRATADO": "Etanol",
    "OLEO DIESEL": "Diesel S-500",
    "OLEO DIESEL S10": "Diesel S-10",
    GNV: "GNV",
  };
  const mesSelecionadoIso = `${indAno}-${String(indMes).padStart(2, "0")}-01`;
  const linhasSaving = savingAnp ?? [];
  const resumirSaving = (linhas: typeof linhasSaving) => {
    const pago = linhas.reduce((s, l) => s + (l.valor_pago_com_referencia ?? 0), 0);
    const ref = linhas.reduce((s, l) => s + (l.valor_referencia ?? 0), 0);
    const litros = linhas.reduce((s, l) => s + l.litros, 0);
    const litrosRef = linhas.reduce((s, l) => s + (l.litros_com_referencia ?? 0), 0);
    return {
      pago,
      ref,
      diferenca: ref - pago, // >0 = pagou abaixo da ANP (economia); <0 = acima
      pct: ref > 0 ? ((ref - pago) / ref) * 100 : 0,
      cobertura: litros > 0 ? (litrosRef / litros) * 100 : 0,
      litrosRef,
    };
  };
  const savingMes = resumirSaving(linhasSaving.filter((l) => l.mes === mesSelecionadoIso));
  const savingPorCategoria = Array.from(
    new Set(linhasSaving.filter((l) => l.mes === mesSelecionadoIso).map((l) => l.categoria))
  )
    .map((cat) => ({ cat, ...resumirSaving(linhasSaving.filter((l) => l.mes === mesSelecionadoIso && l.categoria === cat)) }))
    .sort((a, b) => b.litrosRef - a.litrosRef);
  const savingPorMes = Array.from(new Set(linhasSaving.map((l) => l.mes)))
    .sort()
    .map((mes) => ({ mes, ...resumirSaving(linhasSaving.filter((l) => l.mes === mes)) }));
  const formatarPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;
  const rotuloMes = (iso: string) => {
    const [a, m] = iso.split("-");
    return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  };
  const classeDif = (v: number) =>
    v >= 0 ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400";

  // ---- Painel 11: mix de combustíveis (mês selecionado) ----
  // Participação (%) dentro da categoria. Frota pesada (diesel) e leve (gasolina/etanol) NÃO se misturam;
  // GNV e Arla ficam segregados e não somam no volume das categorias.
  const mixLinhas = mixCombustiveis ?? [];
  const GRUPOS_MIX = ["Frota pesada", "Frota leve"] as const;
  const mixPorGrupo = GRUPOS_MIX.map((g) => {
    const itens = mixLinhas.filter((l) => l.categoria === g).sort((a, b) => b.litros - a.litros);
    const totalLitros = itens.reduce((s, l) => s + l.litros, 0);
    const totalValor = itens.reduce((s, l) => s + l.valor, 0);
    return { grupo: g, itens, totalLitros, totalValor };
  }).filter((g) => g.itens.length > 0);
  const mixSegregados = mixLinhas.filter((l) => l.categoria === "GNV" || l.categoria === "Aditivo (Arla)");

  return (
    <>
            {!paineisOcultosSet.has("dashboard.variacao_precos") && (
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">1. Variação de preços por combustível <AjudaIcon chave="dashboard.variacao_precos" /></h3>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Faixa de preço paga na rede do cliente, comparada à referência ANP do estado mais frequente.
                </p>
                <GraficoVariacaoPrecosLazy dados={variacaoPrecos ?? []} />
              </div>
            )}

            {!paineisOcultosSet.has("dashboard.consumo_diario") && (
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">2. Previsão de consumo — {opcoesMes.find((o) => o.ano === indAno && o.mes === indMes)?.label} <AjudaIcon chave="dashboard.consumo_diario" /></h3>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Litros e custo (R$) por dia; dias restantes do mês projetados com base no padrão de consumo por dia
                  da semana (últimos 90 dias) e no preço médio do período.
                </p>
                <GraficoPrevisaoConsumoLazy dados={dadosPrevisaoConsumoComCusto} />
                {isMesAtual && diaAtual < diasNoMes && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Realizado até o dia {diaAtual}: {totalLitrosMes.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L (
                    {formatarMoeda(totalValorMes)}) · Projeção para os {diasNoMes - diaAtual} dias restantes:{" "}
                    {totalLitrosProjetado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L (
                    {formatarMoeda(totalValorProjetado)}) · Total estimado do mês:{" "}
                    <strong>
                      {(totalLitrosMes + totalLitrosProjetado).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L (
                      {formatarMoeda(totalValorMes + totalValorProjetado)})
                    </strong>
                  </p>
                )}
              </div>
            )}

            {!paineisOcultosSet.has("dashboard.evolucao_preco_medio") && (
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">3. Evolução do preço médio por abastecimento (R$/L) <AjudaIcon chave="dashboard.evolucao_preco_medio" /></h3>
                <GraficoEvolucaoPrecoMedioLazy dados={dadosPrecoMedio} />
              </div>
            )}

            {(!paineisOcultosSet.has("dashboard.volume_postos") || !paineisOcultosSet.has("dashboard.ranking_top5")) && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {!paineisOcultosSet.has("dashboard.volume_postos") && (
                  <div className="card p-4">
                    <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">4. Evolutivo de volume — Top 5 postos <AjudaIcon chave="dashboard.volume_postos" /></h3>
                    <GraficoEvolutivoPostosLazy dados={dadosEvolutivoPostos} postos={postosNomes} />
                  </div>
                )}
                {!paineisOcultosSet.has("dashboard.ranking_top5") && (
                  <div className="card p-4">
                    <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">5. Top 5 postos — maior volume no período <AjudaIcon chave="dashboard.ranking_top5" /></h3>
                    <GraficoTopPostosLazy dados={dadosTopPostos} />
                  </div>
                )}
              </div>
            )}

            {!paineisOcultosSet.has("dashboard.ranking_veiculos") && (
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">6. Ranking de veículos — maior gasto no período <AjudaIcon chave="dashboard.ranking_veiculos" /></h3>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Top 10 no gráfico; frota completa não cabe num único painel.</p>
                <RankingGasto itens={itensRankingVeiculos} colunaExtra="Placa" />
              </div>
            )}

            {!paineisOcultosSet.has("dashboard.ranking_motoristas") && (
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">7. Ranking de motoristas — maior gasto no período <AjudaIcon chave="dashboard.ranking_motoristas" /></h3>
                <RankingGasto itens={itensRankingMotoristas} colunaExtra="Motorista" />
              </div>
            )}

            {!paineisOcultosSet.has("dashboard.eficiencia_veiculos") && (
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">8. Eficiência real por veículo <AjudaIcon chave="dashboard.eficiencia_veiculos" /></h3>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  KM rodado e km/L calculados a partir de hodômetros consecutivos reais dos abastecimentos, de qualquer
                  meio de pagamento integrado (GF). Não inclui comparação com rota planejada — sem dado real de GPS/trajetória,
                  essa parte não é confiável para exibir aqui.
                </p>
                <GraficoEficienciaVeiculosLazy dados={itensEficienciaVeiculos} />
              </div>
            )}

            {!paineisOcultosSet.has("dashboard.desempenho_por_ativo") && (
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">9. Desempenho por marca/modelo/motor <AjudaIcon chave="dashboard.desempenho_por_ativo" /></h3>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Km/L, R$/L pago, custo por km (TCO) e score de manutenção agrupados pelas características do veículo —
                  use pra comparar se vale continuar comprando essa marca/modelo/motor ou trocar de fornecedor.
                </p>
                <TabelaDesempenhoPorAtivo dados={itensDesempenhoPorAtivo} />
              </div>
            )}
      {!paineisOcultosSet.has("dashboard.saving_anp") && (
        <div className="card p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            10. Preço pago vs. referência ANP — {opcoesMes.find((o) => o.ano === indAno && o.mes === indMes)?.label ?? ""}
          </h3>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Compara o preço de bomba pago com a média ANP da semana do abastecimento (município; se não houver, estado;
            depois Brasil). Valores positivos indicam preço abaixo da referência. Descontos negociados não estão
            incluídos: o dado recebido traz só o preço de bomba.
          </p>
          {savingMes.litrosRef === 0 ? (
            <p className="text-sm text-slate-400">Sem abastecimentos com referência ANP no período.</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pago (bomba)</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatarMoeda(savingMes.pago)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Referência ANP</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatarMoeda(savingMes.ref)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {savingMes.diferenca >= 0 ? "Economia vs. ANP" : "Acima da ANP"}
                  </p>
                  <p className={`mt-1 text-lg font-semibold ${classeDif(savingMes.diferenca)}`}>
                    {formatarMoeda(Math.abs(savingMes.diferenca))} ({formatarPct(savingMes.pct)})
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-700">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Litros com referência</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{savingMes.cobertura.toFixed(0)}%</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Por combustível (mês selecionado)</p>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Combustível</th>
                        <th className="py-2 pr-3">Pago</th>
                        <th className="py-2 pr-3">Ref. ANP</th>
                        <th className="py-2">Diferença</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {savingPorCategoria.map((c) => (
                        <tr key={c.cat}>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{NOME_CATEGORIA[c.cat] ?? c.cat}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{formatarMoeda(c.pago)}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{formatarMoeda(c.ref)}</td>
                          <td className={`py-2 tabular-nums font-medium ${classeDif(c.diferenca)}`}>{formatarPct(c.pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Evolução mensal (6 meses)</p>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-2 pr-3">Mês</th>
                        <th className="py-2 pr-3">Pago</th>
                        <th className="py-2 pr-3">Ref. ANP</th>
                        <th className="py-2">Diferença</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {savingPorMes.map((m) => (
                        <tr key={m.mes}>
                          <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{rotuloMes(m.mes)}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{formatarMoeda(m.pago)}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{formatarMoeda(m.ref)}</td>
                          <td className={`py-2 tabular-nums font-medium ${classeDif(m.diferenca)}`}>{formatarPct(m.pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!paineisOcultosSet.has("dashboard.mix_combustiveis") && (
        <div className="card p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            11. Mix de combustíveis — {opcoesMes.find((o) => o.ano === indAno && o.mes === indMes)?.label ?? ""}
          </h3>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Participação de cada produto no volume da sua categoria. Frota pesada (diesel) e frota leve (gasolina e etanol)
            ficam separadas para não distorcer as médias. GNV e Arla aparecem à parte e não entram nesses totais.
          </p>
          {mixPorGrupo.length === 0 && mixSegregados.length === 0 ? (
            <p className="text-sm text-slate-400">Sem abastecimentos no período.</p>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                {mixPorGrupo.map((g) => (
                  <div key={g.grupo}>
                    <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {g.grupo} — {g.totalLitros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L · {formatarMoeda(g.totalValor)}
                    </p>
                    <div className="space-y-2">
                      {g.itens.map((i) => {
                        const pct = g.totalLitros > 0 ? (i.litros / g.totalLitros) * 100 : 0;
                        return (
                          <div key={i.produto}>
                            <div className="mb-0.5 flex items-baseline justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-300">{i.produto}</span>
                              <span className="tabular-nums text-slate-600 dark:text-slate-300">
                                {i.litros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L ·{" "}
                                <strong>{pct.toFixed(1).replace(".", ",")}%</strong>
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                              <div className="h-full rounded-full bg-frota-500" style={{ width: `${Math.max(pct, 1)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {mixSegregados.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {mixSegregados.map((i) => (
                    <div key={i.produto} className="rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-700">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{i.produto} (à parte)</p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {i.litros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} {i.produto === "GNV" ? "m³" : "L"} · {formatarMoeda(i.valor)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

    </>
  );
}
