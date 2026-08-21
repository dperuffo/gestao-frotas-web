import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { calcularPrevisaoConsumo } from "@/lib/previsaoConsumo";
import { resumoAjustesAbastecimentos } from "@/lib/ajustesAbastecimentos";
import { SecaoAjustesAbastecimentos } from "../_components/SecaoAjustesAbastecimentos";
import GraficoConsumoLazy, { type PontoConsumo } from "./_components/GraficoConsumoLazy";
import GraficoVariacaoPrecosLazy from "./_components/GraficoVariacaoPrecosLazy";
import GraficoPrevisaoConsumoLazy from "./_components/GraficoPrevisaoConsumoLazy";
import GraficoEvolucaoPrecoMedioLazy from "./_components/GraficoEvolucaoPrecoMedioLazy";
import GraficoEvolutivoPostosLazy, { type PontoEvolutivoPostos } from "./_components/GraficoEvolutivoPostosLazy";
import GraficoTopPostosLazy from "./_components/GraficoTopPostosLazy";
import { RankingGasto, type ItemRankingGasto } from "./_components/RankingGasto";
import GraficoEficienciaVeiculosLazy, { type ItemEficienciaVeiculo } from "./_components/GraficoEficienciaVeiculosLazy";
import { TabelaDesempenhoPorAtivo, type ItemDesempenhoAtivo } from "./_components/TabelaDesempenhoPorAtivo";
import { PrimeirosPassos } from "./_components/PrimeirosPassos";
import { DashboardPosto } from "./_components/DashboardPosto";
import GraficoMeiosPagamentoLazy from "./_components/GraficoMeiosPagamentoLazy";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { PRODUTOS_POSTO } from "@/lib/constants";
import { Users, Truck, Droplet, Wallet, AlertTriangle, Building2, Trophy } from "lucide-react";
import { IndicadorColorido } from "@/components/IndicadorColorido";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function inicioDoMes(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function rotuloMes(data: Date) {
  return data.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function paraDataISO(data: Date) {
  return data.toISOString().slice(0, 10);
}

// Fase Dashboard-Redesign (12/08/2026) — "X% vs mês passado" nos cards do
// topo (pedido do Daniel, ver benchmark de UX apps bancários). Número
// sozinho diz pouco; número com contexto diz muito. positivoQuandoCai:
// true pros indicadores em que CAIR é bom (custo, gasto); undefined pros
// que são só informativos (litros — mais atividade não é bom nem ruim por
// si só, então fica sempre em tom neutro).
function calcularDelta(
  atual: number,
  anterior: number,
  opts?: { positivoQuandoCai?: boolean }
): { texto: string; tom: "positivo" | "negativo" | "neutro" } | undefined {
  if (!anterior || anterior <= 0) return undefined;
  const variacaoPct = ((atual - anterior) / anterior) * 100;
  const arredondado = Math.round(Math.abs(variacaoPct));
  if (arredondado === 0) return { texto: "≈ igual ao mês passado", tom: "neutro" };
  const subiu = variacaoPct > 0;
  const seta = subiu ? "↑" : "↓";
  let tom: "positivo" | "negativo" | "neutro" = "neutro";
  if (opts?.positivoQuandoCai !== undefined) {
    const bom = opts.positivoQuandoCai ? !subiu : subiu;
    tom = bom ? "positivo" : "negativo";
  }
  return { texto: `${seta} ${arredondado}% vs mês passado`, tom };
}

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type SearchParams = { empresa?: string; mesAno?: string; combustivel?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, mesAno: mesAnoParam, combustivel: combustivelParam } = await searchParams;
  // Fase Dashboard-Filtro-Combustivel (19/07) — pedido do Daniel: seletor de
  // combustível pros indicadores 2 (previsão de consumo), 3 (evolução do
  // preço médio, derivado do mesmo indicador 2) e 4/5 (volume por posto).
  // "" ou ausente = todos os combustíveis (comportamento de sempre).
  const combustivelSelecionado = combustivelParam && combustivelParam.length > 0 ? combustivelParam : null;
  const supabase = await createClient();
  const agora = new Date();
  const inicioMesAtual = inicioDoMes(agora);
  const seisMesesAtras = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  const daqui30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
  // Fase Dashboard-Redesign (12/08/2026) — pedido do Daniel: cards de
  // indicador com comparação ao mês anterior e saudação personalizada no
  // topo (mesmo padrão de app de banco pesquisado no benchmark de UX).
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0);
  const hora = agora.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  // Cliente e período do seletor único do topo — resolvido antes das
  // demais consultas pra poder filtrar por ele os indicadores operacionais
  // (motoristas, veículos, litros/valor/custo, CNH vencendo, gráfico de
  // consumo). "Clientes ativos" e "Top 5 clientes por gasto" continuam em
  // nível de rede (comparam clientes entre si — não faz sentido escopar a
  // um só cliente).
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase 27.56 — achado real: todo mundo cai aqui depois do login (ver
  // src/app/login/actions.ts), mas esta página inteira é voltada pra Frota
  // (veículos, motoristas, consumo) — um posto (segmento "Revenda") nunca
  // teve nada relevante pra ver aqui. Resolve o segmento da empresa
  // selecionada (mesmo padrão de /negociacoes e /abastecimentos-postos) e,
  // se for posto, desvia pra um dashboard próprio antes de rodar qualquer
  // consulta de Frota (evita até as queries desnecessárias abaixo).
  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }
  if (segmentoSelecionado === "Revenda" && empresaSelecionada) {
    return <DashboardPosto empresaPostoId={empresaSelecionada} nomeEmpresaSelecionada={nomeEmpresaSelecionada} />;
  }

  // Fase 27.70 — pedido do Daniel: mesma seção "Ajustes de abastecimento" do
  // lado do posto, agora do lado do cliente/frota (só o "lado" da consulta
  // muda — ver resumoAjustesAbastecimentos). Só faz sentido com um cliente
  // selecionado (ajustes são sempre por empresa_cliente_id específica).
  // Fase Perf-19-07 (achado do Daniel: "lentidão excessiva em muitos
  // pontos") — antes este `await` rodava sozinho, ANTES do Promise.all logo
  // abaixo, como um round-trip extra sequencial. Não depende de nada que o
  // Promise.all busca, então agora entra junto nele (ver item
  // `resumoAjustesPromise`).
  const JANELA_AJUSTES_DIAS = 30;
  const desdeAjustesIso = new Date(Date.now() - JANELA_AJUSTES_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const resumoAjustesPromise = empresaSelecionada
    ? resumoAjustesAbastecimentos(supabase, {
        lado: "cliente",
        empresaId: empresaSelecionada,
        desde: desdeAjustesIso,
      })
    : Promise.resolve(null);

  let queryMotoristasTotal = supabase.from("motoristas").select("id", { count: "exact", head: true });
  let queryMotoristasAtivos = supabase
    .from("motoristas")
    .select("id", { count: "exact", head: true })
    .eq("status", "Ativo");
  let queryCnhVencendo = supabase
    .from("motoristas")
    .select("id, nome_completo, cnh_vencimento")
    .eq("status", "Ativo")
    .not("cnh_vencimento", "is", null)
    .lte("cnh_vencimento", daqui30Dias.toISOString().slice(0, 10))
    .order("cnh_vencimento", { ascending: true })
    .limit(5);

  if (empresaSelecionada) {
    queryMotoristasTotal = queryMotoristasTotal.eq("empresa_id", empresaSelecionada);
    queryMotoristasAtivos = queryMotoristasAtivos.eq("empresa_id", empresaSelecionada);
    queryCnhVencendo = queryCnhVencendo.eq("empresa_id", empresaSelecionada);
  }

  const [
    { count: totalClientes },
    { count: clientesAtivos },
    { count: totalMotoristas },
    { count: motoristasAtivos },
    { count: totalVeiculosGlobal },
    { count: veiculosAtivosGlobal },
    { count: totalPostosProprios },
    { data: cnhVencendo },
    { data: indicadoresPorProvedorMes },
    { data: indicadoresPorProvedorMesAnterior },
    { data: evolucaoMensalRaw },
    { data: topClientesRaw },
    { data: veiculosDaEmpresa },
    resumoAjustes,
    nomeUsuarioLogado,
  ] = await Promise.all([
    supabase.from("empresas").select("id", { count: "exact", head: true }),
    supabase.from("empresas").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    queryMotoristasTotal,
    queryMotoristasAtivos,
    supabase.from("cadastro_veiculos").select("id", { count: "exact", head: true }),
    supabase.from("cadastro_veiculos").select("id", { count: "exact", head: true }).eq("ativo", true),
    // Fase 27.35 — usado só pelo card "Primeiros passos" (ver
    // PrimeirosPassos.tsx): quantos postos revendedores PRÓPRIOS (postos_gf)
    // o cliente já carregou. É informativo/opcional, não bloqueia nada — a
    // Roteirização e a consulta de Postos já funcionam com a base ANP mesmo
    // com esse número em zero.
    empresaSelecionada
      ? supabase.from("postos_gf").select("cnpj", { count: "exact", head: true }).eq("empresa_id", empresaSelecionada)
      : Promise.resolve({ count: 0 }),
    queryCnhVencendo,
    // Fase Dashboard-Provedores-Bug — pedido do Daniel: "Todos os meios de
    // pagamento (Pró-Frotas, Valecard, Rede Frota, TicketLog e Veloe) foram
    // utilizados... e a aplicação registra tudo como Pró-Frotas". Causa
    // raiz: esta página buscava até 5000 linhas CRUAS de
    // abastecimentos_unificado (sem ORDER BY) e agregava tudo em JS — só a
    // Pró-Frotas já tem 9000+ linhas nos últimos 6 meses (rede toda), então
    // o cap de 5000 estourava antes de qualquer linha dos outros provedores
    // (que vêm DEPOIS na UNION ALL da view) ser lida. Trocado por 3 RPCs que
    // agregam (GROUP BY) inteiramente no banco, sem trazer linha nenhuma pro
    // client — mesmo espírito das Fases 27.38/27.69/27.70 (mesma classe de
    // bug, em outras telas). Ver migration dashboard_agregacoes_sem_cap_de_linhas.
    supabase.rpc("indicadores_financeiros_por_provedor", {
      p_empresa_id: empresaSelecionada,
      p_data_inicio: paraDataISO(inicioMesAtual),
      p_data_fim: paraDataISO(agora),
    }),
    // Mesmo indicador do mês atual, só que do mês anterior inteiro — usado
    // só pra calcular a comparação percentual mostrada nos cards do topo.
    supabase.rpc("indicadores_financeiros_por_provedor", {
      p_empresa_id: empresaSelecionada,
      p_data_inicio: paraDataISO(inicioMesAnterior),
      p_data_fim: paraDataISO(fimMesAnterior),
    }),
    supabase.rpc("dashboard_evolucao_mensal", {
      p_empresa_id: empresaSelecionada,
      p_data_inicio: paraDataISO(seisMesesAtras),
    }),
    // Sempre em nível de rede (compara clientes entre si), independente do
    // cliente selecionado no seletor do topo — por isso não recebe
    // p_empresa_id.
    supabase.rpc("dashboard_top_clientes_gasto", {
      p_data_inicio: paraDataISO(seisMesesAtras),
      p_limit: 5,
    }),
    // cadastro_veiculos não tem empresa_id — o vínculo é por cnpj_frota,
    // comparado com empresas.cnpj de forma normalizada (só alfanuméricos,
    // maiúsculo). Comparar direto via .eq("cnpj_frota", empresas.cnpj)
    // falha sempre que um dos dois lados vem formatado diferente do outro
    // (achado real: empresas.cnpj sempre pontuado, cadastro_veiculos com
    // registros pontuados e não pontuados misturados) — por isso usamos a
    // RPC `veiculos_da_empresa`, que resolve isso no banco com a mesma
    // normalização já usada pela RLS via `empresa_id_do_cnpj`.
    // Fase 27.38 — buscarTodosVeiculosDaEmpresa pagina essa RPC em lotes de
    // 1000 (limite padrão do Supabase/PostgREST por resposta) — sem isso,
    // clientes com mais de 1000 veículos tinham a contagem "Veículos
    // ativos"/"de X" subestimada aqui no Dashboard.
    empresaSelecionada
      ? buscarTodosVeiculosDaEmpresa(supabase, empresaSelecionada)
      : Promise.resolve({ data: null }),
    resumoAjustesPromise,
    // Primeiro nome do usuário logado, pra saudação no topo da página —
    // mesmo padrão de busca (tabela usuarios_app por e-mail) já usado em
    // (dashboard)/layout.tsx pro nome exibido na barra lateral.
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return null;
      const { data } = await supabase.from("usuarios_app").select("nome").eq("email", user.email).maybeSingle();
      return data?.nome ?? null;
    })(),
  ]);

  const totalVeiculos = empresaSelecionada ? (veiculosDaEmpresa ?? []).length : totalVeiculosGlobal;
  const veiculosAtivos = empresaSelecionada
    ? (veiculosDaEmpresa ?? []).filter((v) => v.ativo).length
    : veiculosAtivosGlobal;
  const primeiroNome = nomeUsuarioLogado ? String(nomeUsuarioLogado).trim().split(" ")[0] : null;

  // Fase Dashboard-Provedores-Bug — litros/valor do mês e o consolidado por
  // meio de pagamento agora vêm agregados direto do banco (RPC
  // indicadores_financeiros_por_provedor, já escopada por empresaSelecionada
  // e pelo mês atual), sem trazer linha nenhuma de abastecimento pro client.
  const listaProvedoresMes: [string, number][] = (indicadoresPorProvedorMes ?? []).map((r) => [
    r.provedor,
    r.custo_combustivel,
  ]);
  const litrosMes = (indicadoresPorProvedorMes ?? []).reduce((soma, r) => soma + (r.litros ?? 0), 0);
  const valorMes = (indicadoresPorProvedorMes ?? []).reduce((soma, r) => soma + (r.custo_combustivel ?? 0), 0);
  const custoMedioLitroMes = litrosMes > 0 ? valorMes / litrosMes : 0;
  const litrosMesAnterior = (indicadoresPorProvedorMesAnterior ?? []).reduce((soma, r) => soma + (r.litros ?? 0), 0);
  const valorMesAnterior = (indicadoresPorProvedorMesAnterior ?? []).reduce(
    (soma, r) => soma + (r.custo_combustivel ?? 0),
    0
  );
  const custoMedioLitroMesAnterior = litrosMesAnterior > 0 ? valorMesAnterior / litrosMesAnterior : 0;
  const deltaLitros = calcularDelta(litrosMes, litrosMesAnterior);
  const deltaValor = calcularDelta(valorMes, valorMesAnterior, { positivoQuandoCai: true });
  const deltaCustoMedio = calcularDelta(custoMedioLitroMes, custoMedioLitroMesAnterior, { positivoQuandoCai: true });

  // Gráfico: 6 meses fixos (mesmo os sem abastecimento nenhum aparecem
  // zerados) preenchidos com o que a RPC dashboard_evolucao_mensal trouxe
  // já agregado por mês.
  const porMes = new Map<string, PontoConsumo>();
  for (let i = 5; i >= 0; i--) {
    const data = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    porMes.set(chave, { mes: rotuloMes(data), litros: 0, valor: 0 });
  }
  for (const r of evolucaoMensalRaw ?? []) {
    const data = new Date(`${r.mes}T00:00:00`);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    const ponto = porMes.get(chave);
    if (ponto) {
      ponto.litros = r.litros ?? 0;
      ponto.valor = r.valor ?? 0;
    }
  }
  const dadosGrafico = Array.from(porMes.values()).map((p) => ({ ...p, litros: Math.round(p.litros) }));

  // Top 5 clientes por gasto (últimos 6 meses) — sempre em nível de rede
  // (RPC dashboard_top_clientes_gasto não recebe empresa, agrega por
  // empresa_id direto no banco), independente do cliente selecionado.
  const idsTop = (topClientesRaw ?? []).map((r) => r.empresa_id);
  const valorPorEmpresaTop = new Map((topClientesRaw ?? []).map((r) => [r.empresa_id, r.valor ?? 0]));
  // Fase 27.128 — achado real (Daniel: painel mostrando UUID em vez do nome
  // do cliente): mesma causa raiz já corrigida na Fase 27.51 (negociações)
  // — um join direto em `empresas` falha em silêncio pra qualquer linha que
  // a RLS de `empresas_select_membro` não libere pra quem está rodando esta
  // consulta (aqui, o próprio card já soma abastecimentos de TODOS os
  // clientes — de propósito, "sempre em nível de rede" — então nem sempre
  // quem está vendo o dashboard tem vínculo direto com cada empresa do
  // ranking). Troca pela RPC SECURITY DEFINER `nome_empresa_publico` (mesma
  // já usada em negociacoesPostos.ts), que só devolve o nome — nada sensível
  // — bypassando essa RLS de propósito.
  // Fase Perf-19-07 — antes eram até 5 chamadas RPC individuais (uma por
  // cliente do ranking, em `Promise.all`, mas ainda assim 5 round-trips
  // separados ao banco). `nomes_empresas_publico` resolve todos de uma vez.
  const { data: nomesTopRows } =
    idsTop.length > 0 ? await supabase.rpc("nomes_empresas_publico", { p_empresa_ids: idsTop }) : { data: [] };
  const nomePorEmpresaId = new Map((nomesTopRows ?? []).map((r) => [r.id as string, r.nome as string | null]));
  const topClientes = idsTop.map((id) => ({ nome: nomePorEmpresaId.get(id) ?? id, valor: valorPorEmpresaTop.get(id)! }));

  // Mês selecionado no seletor único no topo da página — direciona, junto
  // com o cliente (já resolvido acima), os indicadores de centro de custo e
  // os 7 indicadores avançados. Manutenção preditiva não depende do período
  // (é o estado atual da frota), só do cliente.
  const anoAtual = agora.getFullYear();
  const mesAtualNum = agora.getMonth() + 1;
  const [mesAnoAnoStr, mesAnoMesStr] = (mesAnoParam ?? `${anoAtual}-${mesAtualNum}`).split("-");
  const indAno = Number(mesAnoAnoStr) || anoAtual;
  const indMes = Math.min(12, Math.max(1, Number(mesAnoMesStr) || mesAtualNum));
  const primeiroDiaMes = new Date(indAno, indMes - 1, 1);
  const diasNoMes = new Date(indAno, indMes, 0).getDate();
  const isMesAtual = indAno === anoAtual && indMes === mesAtualNum;
  const isMesFuturo = indAno > anoAtual || (indAno === anoAtual && indMes > mesAtualNum);
  const diaAtual = isMesAtual ? agora.getDate() : isMesFuturo ? 0 : diasNoMes;
  const dataInicioInd = paraDataISO(primeiroDiaMes);
  const dataFimInd = paraDataISO(new Date(indAno, indMes - 1, Math.max(1, diaAtual || diasNoMes)));
  const opcoesMes: { ano: number; mes: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const data = new Date(anoAtual, mesAtualNum - 1 - i, 1);
    opcoesMes.push({ ano: data.getFullYear(), mes: data.getMonth() + 1, label: `${NOMES_MES[data.getMonth()]} ${data.getFullYear()}` });
  }

  // Fase Perf-19-07 (achado do Daniel: "lentidão excessiva em muitos
  // pontos") — indicadores de centro de custo e manutenção preditiva não
  // dependem um do outro nem dos 7 indicadores avançados logo abaixo (todos
  // só precisam de empresaSelecionada/dataInicioInd/dataFimInd, já
  // calculados). Antes eram 2 `await`s sequenciais + um Promise.all de 7 —
  // 3 round-trips completos, um atrás do outro. Agora tudo entra num único
  // Promise.all de 9.
  const [
    { data: indicadoresCentroCusto, error: erroCentroCusto },
    { data: manutencaoKpisRows },
    { data: variacaoPrecos },
    { data: consumoDiario },
    { data: padraoDiaSemanaRows },
    { data: volumePostos },
    { data: rankingVeiculos },
    { data: rankingMotoristas },
    { data: eficienciaVeiculos },
    { data: desempenhoPorAtivo },
  ] = empresaSelecionada
    ? await Promise.all([
        supabase.rpc("indicadores_centro_custo", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        // Fase 05/08/2026 (achado real do Daniel: "a empresa selecionada...
        // nao esta sendo respeitado... a indicacao de manutençao
        // preventiva") -- manutencao_preditiva_kpis por padrão expande pro
        // GRUPO ECONÔMICO inteiro (ver manutencao_preditiva_base), deliberado
        // na tela dedicada /manutencao-preditiva (mostra `empresa_dona_nome`
        // de propósito), mas o card do dashboard tem que respeitar só a
        // empresa escolhida no seletor único do topo -- daí `p_somente_empresa: true`.
        supabase.rpc("manutencao_preditiva_kpis", { p_empresa_id: empresaSelecionada, p_somente_empresa: true }),
        supabase.rpc("indicador_variacao_precos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        supabase.rpc("indicador_consumo_diario", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
          p_combustivel: combustivelSelecionado,
        }),
        supabase.rpc("indicador_padrao_dia_semana", {
          p_empresa_id: empresaSelecionada,
          p_dias_lookback: 90,
          p_combustivel: combustivelSelecionado,
        }),
        supabase.rpc("indicador_volume_postos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
          p_combustivel: combustivelSelecionado,
        }),
        supabase.rpc("indicador_ranking_veiculos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
          p_limit: 10,
          p_offset: 0,
        }),
        supabase.rpc("indicador_ranking_motoristas", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
          p_limit: 10,
          p_offset: 0,
        }),
        supabase.rpc("indicador_eficiencia_veiculos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        // Fase Desempenho-Por-Ativo (12/08/2026) — pedido do Daniel: comparar
        // desempenho de veículos agrupado por marca/modelo/motor (não por
        // placa individual), pra apoiar decisão de compra/customização de
        // frota. Compõe 3 RPCs já existentes (ver comentário na migração
        // desempenho_veiculos_grupo).
        supabase.rpc("desempenho_veiculos_grupo", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
      ])
    : [
        { data: null, error: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
        { data: null },
      ];

  const totaisCentroCusto = (indicadoresCentroCusto ?? []).reduce(
    (acc, c) => ({
      veiculos: acc.veiculos + (c.qtd_veiculos ?? 0),
      abastecimento: acc.abastecimento + (c.custo_abastecimento ?? 0),
      manutencao: acc.manutencao + (c.custo_manutencao ?? 0),
    }),
    { veiculos: 0, abastecimento: 0, manutencao: 0 }
  );

  const manutencaoKpis = manutencaoKpisRows?.[0];

  // Indicador 2 — Previsão de consumo: dias reais + projeção calibrada por
  // dia da semana (só projeta se o mês selecionado for o atual e ainda
  // faltar dia pra terminar).
  const diasReaisMap = new Map<number, number>();
  for (const d of consumoDiario ?? []) {
    const dia = new Date(`${d.dia}T00:00:00`).getDate();
    diasReaisMap.set(dia, d.litros ?? 0);
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

  // Indicador 8 — Eficiência real por veículo: km rodado e km/L calculados a
  // partir de hodômetros consecutivos reais dos abastecimentos (não de rota
  // planejada/sugerida — essa parte do painel de referência foi
  // deliberadamente deixada de fora por não termos dado de GPS real).
  const itensEficienciaVeiculos: ItemEficienciaVeiculo[] = (eficienciaVeiculos ?? []).map((v) => ({
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    abastecimentos: v.abastecimentos,
    kmTotal: v.km_total,
    kmMedio: v.km_medio,
    mediaKmL: v.media_km_l,
    litrosTotal: v.litros_total,
    precoMedio: v.preco_medio,
    custoTotal: v.custo_total,
  }));

  // Fase Dashboard-Redesign — "Destaque do mês": veículo com melhor km/L no
  // período, comparado à média da frota. Mesmo dado do indicador 8 abaixo,
  // resumido num card no topo — storytelling em vez de só número cru (ver
  // benchmark de UX apps bancários).
  const mediasKmLValidas = itensEficienciaVeiculos
    .map((v) => v.mediaKmL)
    .filter((v): v is number => v != null && v > 0);
  const mediaGeralKmL =
    mediasKmLValidas.length > 0 ? mediasKmLValidas.reduce((s, v) => s + v, 0) / mediasKmLValidas.length : null;
  const veiculoDestaque = itensEficienciaVeiculos.reduce<ItemEficienciaVeiculo | null>((melhor, v) => {
    if (v.mediaKmL == null) return melhor;
    if (melhor == null || (melhor.mediaKmL ?? 0) < v.mediaKmL) return v;
    return melhor;
  }, null);
  const percentualAcimaMedia =
    veiculoDestaque?.mediaKmL != null && mediaGeralKmL
      ? Math.round(((veiculoDestaque.mediaKmL - mediaGeralKmL) / mediaGeralKmL) * 100)
      : null;

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          {saudacao}
          {primeiroNome ? `, ${primeiroNome}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Aqui está o resumo da sua frota hoje.</p>
      </div>

      <div className="mb-6 card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Cliente e período</h2>
            <p className="text-xs text-slate-500">
              Direciona os indicadores da frota abaixo pelo cliente selecionado (motoristas, veículos,
              consumo, CNH, centro de custo e indicadores avançados). &quot;Clientes ativos&quot; e
              &quot;Top 5 clientes por gasto&quot; continuam sempre em nível de rede.
            </p>
          </div>
          <form className="flex items-end gap-2">
            {combustivelSelecionado && <input type="hidden" name="combustivel" value={combustivelSelecionado} />}
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
              <label className="mb-1 block text-xs font-medium text-slate-500">Período</label>
              <select name="mesAno" defaultValue={`${indAno}-${indMes}`} className="input text-sm">
                {opcoesMes.map((o) => (
                  <option key={`${o.ano}-${o.mes}`} value={`${o.ano}-${o.mes}`}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary text-sm">
              Aplicar
            </button>
          </form>
        </div>
      </div>

      {empresaSelecionada && (
        <PrimeirosPassos
          totalVeiculos={totalVeiculos ?? 0}
          totalMotoristas={totalMotoristas ?? 0}
          totalPostosProprios={totalPostosProprios ?? 0}
        />
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <IndicadorColorido cor="violet" icon={Building2} label="Clientes ativos" valor={String(clientesAtivos ?? 0)} sub={`de ${totalClientes ?? 0}`} ajudaChave="dashboard.clientes_ativos" />
        <IndicadorColorido cor="sky" icon={Users} label="Motoristas ativos" valor={String(motoristasAtivos ?? 0)} sub={`de ${totalMotoristas ?? 0}`} ajudaChave="dashboard.motoristas_veiculos_ativos" />
        <IndicadorColorido cor="sky" icon={Truck} label="Veículos ativos" valor={String(veiculosAtivos ?? 0)} sub={`de ${totalVeiculos ?? 0}`} ajudaChave="dashboard.motoristas_veiculos_ativos" />
        <IndicadorColorido cor="green" icon={Droplet} label="Litros no mês" valor={litrosMes.toLocaleString("pt-BR")} delta={deltaLitros} ajudaChave="dashboard.litros_mes" />
        <IndicadorColorido cor="amber" icon={Wallet} label="Valor no mês" valor={formatarMoeda(valorMes)} delta={deltaValor} ajudaChave="dashboard.valor_mes" />
        <IndicadorColorido cor="red" icon={AlertTriangle} label="Custo médio/litro" valor={formatarMoeda(custoMedioLitroMes)} delta={deltaCustoMedio} ajudaChave="dashboard.custo_medio_litro" />
      </div>

      {empresaSelecionada && veiculoDestaque && veiculoDestaque.mediaKmL != null && (
        <div className="mb-6 card flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-frota-500">
            <Trophy className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <p className="text-sm text-slate-600">
            Destaque do mês: a placa <span className="font-medium text-slate-900">{veiculoDestaque.placa}</span> teve
            o melhor km/L da frota ({veiculoDestaque.mediaKmL.toFixed(2)} km/l)
            {percentualAcimaMedia != null && percentualAcimaMedia > 0 && <>, {percentualAcimaMedia}% acima da média</>}.
          </p>
        </div>
      )}

      {empresaSelecionada && listaProvedoresMes.length > 0 && (
        <div className="mb-6 card p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            Meios de pagamento no mês
          </p>
          <GraficoMeiosPagamentoLazy dados={listaProvedoresMes.map(([provedor, valor]) => ({ provedor, valor }))} />
        </div>
      )}

      {resumoAjustes && (
        <SecaoAjustesAbastecimentos
          pendentes={resumoAjustes.pendentes}
          aceitosNoPeriodo={resumoAjustes.aceitosNoPeriodo}
          impactoFinanceiro={resumoAjustes.impactoFinanceiro}
          ultimosAjustes={resumoAjustes.ultimosAjustes}
          diasPeriodo={JANELA_AJUSTES_DIAS}
        />
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            Consumo e gasto — últimos 6 meses <AjudaIcon chave="dashboard.consumo_grafico" />
          </h2>
          <GraficoConsumoLazy dados={dadosGrafico} />
        </div>

        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            CNH vencendo em 30 dias <AjudaIcon chave="dashboard.cnh_vencendo" />
          </h2>
          {cnhVencendo && cnhVencendo.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {cnhVencendo.map((m) => {
                const dias = Math.max(
                  0,
                  Math.ceil((new Date(`${m.cnh_vencimento}T00:00:00`).getTime() - agora.getTime()) / 86400000)
                );
                const urgente = dias <= 7;
                return (
                  <li key={m.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Link href={`/motoristas/${m.id}`} className="text-frota-600 hover:underline">
                        {m.nome_completo}
                      </Link>
                      <span
                        className={`whitespace-nowrap text-xs font-medium ${urgente ? "text-status-inativo" : "text-status-atencao"}`}
                      >
                        {dias} {dias === 1 ? "dia" : "dias"} · {formatDate(m.cnh_vencimento)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${urgente ? "bg-status-inativo" : "bg-status-atencao"}`}
                        style={{ width: `${Math.min(100, Math.max(6, (dias / 30) * 100))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Nenhuma CNH vencendo nos próximos 30 dias.</p>
          )}
        </div>
      </div>

      <div className="mb-6 card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          Top 5 clientes por gasto (últimos 6 meses) <AjudaIcon chave="dashboard.top_clientes" />
        </h2>
        {topClientes.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Cliente</th>
                <th className="py-2">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topClientes.map((c) => (
                <tr key={c.nome}>
                  <td className="py-2 text-slate-700">{c.nome}</td>
                  <td className="py-2 text-slate-700">{formatarMoeda(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">Ainda não há abastecimentos vinculados a um cliente.</p>
        )}
      </div>

      <div className="card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          Desempenho por centro de custo <AjudaIcon chave="dashboard.centro_custo" />
        </h2>

        {!empresaSelecionada && (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Selecione um cliente no seletor do topo da página para ver os indicadores dos centros de custo dele.
          </p>
        )}

        {empresaSelecionada && erroCentroCusto && (
          <p className="text-sm text-red-600">Erro ao carregar indicadores: {erroCentroCusto.message}</p>
        )}

        {empresaSelecionada && !erroCentroCusto && (
          <>
            {nomeEmpresaSelecionada && (
              <p className="mb-3 text-xs text-slate-500">
                Cliente: <span className="font-medium text-slate-700">{nomeEmpresaSelecionada}</span> ·{" "}
                {opcoesMes.find((o) => o.ano === indAno && o.mes === indMes)?.label}
              </p>
            )}

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniIndicador label="Veículos alocados" valor={String(totaisCentroCusto.veiculos)} />
              <MiniIndicador label="Custo de abastecimento" valor={formatarMoeda(totaisCentroCusto.abastecimento)} />
              <MiniIndicador label="Custo de manutenção" valor={formatarMoeda(totaisCentroCusto.manutencao)} />
            </div>

            {indicadoresCentroCusto && indicadoresCentroCusto.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Centro de custo</th>
                      <th className="py-2 pr-4">Veículos</th>
                      <th className="py-2 pr-4">Custo abastecimento</th>
                      <th className="py-2 pr-4">Custo manutenção</th>
                      <th className="py-2 pr-4">Custo total/km</th>
                      <th className="py-2">Consumo médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {indicadoresCentroCusto.map((c) => (
                      <tr key={c.centro_custo_id}>
                        <td className="py-2.5 pr-4">
                          <Link
                            href={`/centros-custo/${c.centro_custo_id}`}
                            className="font-medium text-frota-600 hover:underline"
                          >
                            {c.centro_custo_nome}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600">{c.qtd_veiculos}</td>
                        <td className="py-2.5 pr-4 text-slate-600">{formatarMoeda(c.custo_abastecimento ?? 0)}</td>
                        <td className="py-2.5 pr-4 text-slate-600">{formatarMoeda(c.custo_manutencao ?? 0)}</td>
                        <td className="py-2.5 pr-4 text-slate-600">
                          {c.custo_por_km != null ? `R$ ${c.custo_por_km.toFixed(3)}` : "—"}
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {c.consumo_medio != null ? `${c.consumo_medio.toFixed(2)} km/l` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nenhum centro de custo cadastrado para este cliente.</p>
            )}
          </>
        )}
      </div>

      {empresaSelecionada && manutencaoKpis && (
        <div className="mt-6 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              Manutenção preditiva <AjudaIcon chave="dashboard.manutencao_preditiva" />
            </h2>
            <Link href="/manutencao-preditiva" className="text-xs font-medium text-frota-600 hover:underline">
              Ver frota completa →
            </Link>
          </div>
          {manutencaoKpis.total_criticos > 0 && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              🚨 <strong>{manutencaoKpis.total_criticos} veículo(s) em estado crítico</strong> — pelo menos um
              componente vencido pelo km rodado.{" "}
              <Link href="/manutencao-preditiva?status=critico" className="underline">
                Ver quais
              </Link>
              .
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniIndicador label="Veículos analisados" valor={String(manutencaoKpis.total_veiculos)} />
            <MiniIndicador label="🔴 Críticos" valor={String(manutencaoKpis.total_criticos)} />
            <MiniIndicador label="🟡 Em alerta" valor={String(manutencaoKpis.total_alertas)} />
            <MiniIndicador label="Score médio" valor={`${Math.round(manutencaoKpis.score_medio)}/100`} />
          </div>
        </div>
      )}

      <div id="indicadores-avancados" className="mt-8 scroll-mt-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Indicadores avançados</h2>
            <p className="text-sm text-slate-500">Preços, consumo e rankings do período selecionado no topo da página.</p>
          </div>
          {/* Fase Dashboard-Filtro-Combustivel (19/07) — pedido do Daniel:
              seletor de combustível pros indicadores 2 (previsão de
              consumo), 3 (evolução do preço médio) e 4/5 (volume por
              posto). Campos ocultos preservam cliente/período já
              selecionados no topo da página (senão o submit deste form
              perderia esses filtros). */}
          {empresaSelecionada && (
            <form className="flex items-end gap-2">
              <input type="hidden" name="empresa" value={empresaSelecionada} />
              <input type="hidden" name="mesAno" value={`${indAno}-${indMes}`} />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Combustível</label>
                <select name="combustivel" defaultValue={combustivelSelecionado ?? ""} className="input text-sm">
                  <option value="">Todos os combustíveis</option>
                  {PRODUTOS_POSTO.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-secondary text-sm">
                Filtrar
              </button>
            </form>
          )}
        </div>

        {!empresaSelecionada && (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Selecione um cliente no seletor do topo da página para ver os indicadores avançados dele.
          </p>
        )}

        {empresaSelecionada && (
          <div className="space-y-6">
            {combustivelSelecionado && (
              <p className="rounded-lg bg-frota-50 px-4 py-2.5 text-sm text-frota-700">
                Indicadores 2, 3, 4 e 5 filtrados por <strong>{combustivelSelecionado}</strong>. O indicador 1 (Variação
                de preços) já compara todos os combustíveis lado a lado e continua mostrando todos.{" "}
                <Link href={`?empresa=${empresaSelecionada}&mesAno=${indAno}-${indMes}`} className="underline">
                  Limpar filtro
                </Link>
              </p>
            )}
            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">1. Variação de preços por combustível <AjudaIcon chave="dashboard.variacao_precos" /></h3>
              <p className="mb-3 text-xs text-slate-500">
                Faixa de preço paga na rede do cliente, comparada à referência ANP do estado mais frequente.
              </p>
              <GraficoVariacaoPrecosLazy dados={variacaoPrecos ?? []} />
            </div>

            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">2. Previsão de consumo — {opcoesMes.find((o) => o.ano === indAno && o.mes === indMes)?.label} <AjudaIcon chave="dashboard.consumo_diario" /></h3>
              <p className="mb-3 text-xs text-slate-500">
                Litros por dia; dias restantes do mês projetados com base no padrão de consumo por dia da semana
                (últimos 90 dias).
              </p>
              <GraficoPrevisaoConsumoLazy dados={dadosPrevisaoConsumo} />
              {isMesAtual && diaAtual < diasNoMes && (
                <p className="mt-2 text-xs text-slate-500">
                  Realizado até o dia {diaAtual}: {totalLitrosMes.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L
                  · Projeção para os {diasNoMes - diaAtual} dias restantes:{" "}
                  {totalLitrosProjetado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L · Total estimado do mês:{" "}
                  <strong>{(totalLitrosMes + totalLitrosProjetado).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L</strong>
                </p>
              )}
            </div>

            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">3. Evolução do preço médio por abastecimento (R$/L) <AjudaIcon chave="dashboard.evolucao_preco_medio" /></h3>
              <GraficoEvolucaoPrecoMedioLazy dados={dadosPrecoMedio} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">4. Evolutivo de volume — Top 5 postos <AjudaIcon chave="dashboard.volume_postos" /></h3>
                <GraficoEvolutivoPostosLazy dados={dadosEvolutivoPostos} postos={postosNomes} />
              </div>
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">5. Top 5 postos — maior volume no período <AjudaIcon chave="dashboard.ranking_top5" /></h3>
                <GraficoTopPostosLazy dados={dadosTopPostos} />
              </div>
            </div>

            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">6. Ranking de veículos — maior gasto no período <AjudaIcon chave="dashboard.ranking_veiculos" /></h3>
              <p className="mb-3 text-xs text-slate-500">Top 10 no gráfico; frota completa não cabe num único painel.</p>
              <RankingGasto itens={itensRankingVeiculos} colunaExtra="Placa" />
            </div>

            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">7. Ranking de motoristas — maior gasto no período <AjudaIcon chave="dashboard.ranking_motoristas" /></h3>
              <RankingGasto itens={itensRankingMotoristas} colunaExtra="Motorista" />
            </div>

            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">8. Eficiência real por veículo <AjudaIcon chave="dashboard.eficiencia_veiculos" /></h3>
              <p className="mb-3 text-xs text-slate-500">
                KM rodado e km/L calculados a partir de hodômetros consecutivos reais dos abastecimentos, de qualquer
                meio de pagamento integrado (GF). Não inclui comparação com rota planejada — sem dado real de GPS/trajetória,
                essa parte não é confiável para exibir aqui.
              </p>
              <GraficoEficienciaVeiculosLazy dados={itensEficienciaVeiculos} />
            </div>

            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">9. Desempenho por marca/modelo/motor <AjudaIcon chave="dashboard.desempenho_por_ativo" /></h3>
              <p className="mb-3 text-xs text-slate-500">
                Km/L, R$/L pago, custo por km (TCO) e score de manutenção agrupados pelas características do veículo —
                use pra comparar se vale continuar comprando essa marca/modelo/motor ou trocar de fornecedor.
              </p>
              <TabelaDesempenhoPorAtivo dados={itensDesempenhoPorAtivo} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// IndicadorColorido agora vive em @/components/IndicadorColorido — extraído
// pra cá pra ser reaproveitado também na tela de Veículos (ver Fase
// Dashboard-Redesign).

function MiniIndicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
