import Link from "next/link";
import { Suspense } from "react";
import { SecaoIndicadoresAvancados, FallbackAvancados } from "./_components/SecaoIndicadoresAvancados";
import { createClient } from "@/lib/supabase/server";
import { rpcCacheado } from "@/lib/rpcCacheado";
import { obterUsuarioAtual } from "@/lib/supabase/usuarioAtual";
import { segmentoEmpresaCacheado } from "@/lib/dadosUsuarioCache";
import { formatDate } from "@/lib/utils";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { resumoAjustesAbastecimentos } from "@/lib/ajustesAbastecimentos";
import { SecaoAjustesAbastecimentos } from "../_components/SecaoAjustesAbastecimentos";
import GraficoConsumoLazy, { type PontoConsumo } from "./_components/GraficoConsumoLazy";
import { type ItemEficienciaVeiculo } from "./_components/GraficoEficienciaVeiculosLazy";
import { PrimeirosPassos } from "./_components/PrimeirosPassos";
import { ConfigPaineis, type OpcaoPainel } from "./_components/ConfigPaineis";
import { buscarPaineisOcultosAcao } from "./preferenciasActions";
import { DashboardPosto } from "./_components/DashboardPosto";
import GraficoMeiosPagamentoLazy from "./_components/GraficoMeiosPagamentoLazy";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { PRODUTOS_POSTO } from "@/lib/constants";
import { Users, Truck, Droplet, Wallet, AlertTriangle, Building2, Trophy } from "lucide-react";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { CampoPerguntaFni } from "../_components/CampoPerguntaFni";

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
  // Componente é Server Component (roda no servidor, provavelmente em UTC),
  // então `agora.getHours()` pegava a hora do servidor, não a de Brasília —
  // por isso a saudação aparecia ~3h adiantada. Calculamos explicitamente
  // no fuso America/Sao_Paulo com Intl.DateTimeFormat (nativo, sem
  // depender de libs de timezone que o projeto não tem instaladas).
  const hora = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(agora)
  );
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  // Cliente e período do seletor único do topo — resolvido antes das
  // demais consultas pra poder filtrar por ele os indicadores operacionais
  // (motoristas, veículos, litros/valor/custo, CNH vencendo, gráfico de
  // consumo). "Clientes ativos" e "Top 5 clientes por gasto" continuam em
  // nível de rede (comparam clientes entre si — não faz sentido escopar a
  // um só cliente).
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  // Id do usuário entra na chave do cache das RPCs (RLS: nunca compartilhar entre usuários).
  const usuarioId = (await obterUsuarioAtual()).data.user?.id ?? "anon";

  // Fase 27.56 — achado real: todo mundo cai aqui depois do login (ver
  // src/app/login/actions.ts), mas esta página inteira é voltada pra Frota
  // (veículos, motoristas, consumo) — um posto (segmento "Revenda") nunca
  // teve nada relevante pra ver aqui. Resolve o segmento da empresa
  // selecionada (mesmo padrão de /negociacoes e /abastecimentos-postos) e,
  // se for posto, desvia pra um dashboard próprio antes de rodar qualquer
  // consulta de Frota (evita até as queries desnecessárias abaixo).
  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    segmentoSelecionado = await segmentoEmpresaCacheado(supabase, empresaSelecionada);
  }
  if (segmentoSelecionado === "Revenda" && empresaSelecionada) {
    return <DashboardPosto empresaPostoId={empresaSelecionada} nomeEmpresaSelecionada={nomeEmpresaSelecionada} />;
  }

  // Perf (22/11/2026): o 2º grupo de indicadores (centro de custo, manutenção, variação de preço,
  // rankings...) só depende do cliente e do período — não do resultado do 1º grupo. Antes rodava
  // DEPOIS dele (e depois da busca dos nomes do ranking): 3 etapas em fila, cada uma pagando a
  // viagem Virginia–São Paulo. Agora dispara aqui, junto com o 1º, e é aguardado mais abaixo.
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
  const grupo2 = empresaSelecionada ? [
        rpcCacheado(supabase, usuarioId, "indicadores_centro_custo", {
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
        rpcCacheado(supabase, usuarioId, "manutencao_preditiva_kpis", { p_empresa_id: empresaSelecionada, p_somente_empresa: true }),
        rpcCacheado(supabase, usuarioId, "indicador_variacao_precos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        rpcCacheado(supabase, usuarioId, "indicador_consumo_diario", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
          p_combustivel: combustivelSelecionado,
        }),
        rpcCacheado(supabase, usuarioId, "indicador_padrao_dia_semana", {
          p_empresa_id: empresaSelecionada,
          p_dias_lookback: 90,
          p_combustivel: combustivelSelecionado,
        }),
        rpcCacheado(supabase, usuarioId, "indicador_volume_postos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
          p_combustivel: combustivelSelecionado,
        }),
        rpcCacheado(supabase, usuarioId, "indicador_ranking_veiculos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
          p_limit: 10,
          p_offset: 0,
        }),
        rpcCacheado(supabase, usuarioId, "indicador_ranking_motoristas", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
          p_limit: 10,
          p_offset: 0,
        }),
        rpcCacheado(supabase, usuarioId, "indicador_eficiencia_veiculos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        // Fase Desempenho-Por-Ativo (12/08/2026) — pedido do Daniel: comparar
        // desempenho de veículos agrupado por marca/modelo/motor (não por
        // placa individual), pra apoiar decisão de compra/customização de
        // frota. Compõe 3 RPCs já existentes (ver comentário na migração
        // desempenho_veiculos_grupo).
        rpcCacheado(supabase, usuarioId, "desempenho_veiculos_grupo", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        // KPI "Rendimento com Correção Estatística" (KMV-315): km/L sem outliers
        // de odômetro/abastecimento externo + selo de confiança por veículo.
        rpcCacheado(supabase, usuarioId, "indicador_rendimento_corrigido", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        // KPI "Preço pago vs. referência ANP" (KMV-315): 6 meses até o mês selecionado.
        rpcCacheado(supabase, usuarioId, "cliente_saving_anp", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: paraDataISO(new Date(indAno, indMes - 6, 1)),
          p_data_fim: dataFimInd,
        }),
      ] as const : null;

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

  // Fase UX-Navegacao (27/08/2026) — disparado em paralelo com o Promise.all
  // grande logo abaixo (não fica dentro dele pra não precisar destrinchar
  // esse array gigante só por causa de mais 1 chamada independente).
  const paineisOcultosPromise = buscarPaineisOcultosAcao();

  const [
    { count: totalClientes },
    { count: clientesAtivos },
    { count: totalMotoristas },
    { count: motoristasAtivos },
    { count: totalVeiculosGlobal },
    { count: veiculosAtivosGlobal },
    { count: totalPostosProprios },
    { count: totalCentrosCusto },
    { count: totalVinculosEquipe },
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
    // Fase UX-Navegacao (27/08/2026) — usados só pelo card "Primeiros
    // passos" (PrimeirosPassos.tsx), extensão pedida no roadmap de
    // navegação: além de veículo/motorista, informa se a empresa já
    // configurou centro de custo (usado em rateio de despesas) e se já
    // convidou alguém da equipe (além de quem criou a conta). Ambos
    // opcionais — não bloqueiam nada, só orientam o próximo passo.
    empresaSelecionada
      ? supabase.from("centros_custo").select("id", { count: "exact", head: true }).eq("empresa_id", empresaSelecionada)
      : Promise.resolve({ count: 0 }),
    empresaSelecionada
      ? supabase.from("usuarios_empresas").select("user_email", { count: "exact", head: true }).eq("empresa_id", empresaSelecionada)
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
    rpcCacheado(supabase, usuarioId, "indicadores_financeiros_por_provedor", {
      p_empresa_id: empresaSelecionada,
      p_data_inicio: paraDataISO(inicioMesAtual),
      p_data_fim: paraDataISO(agora),
    }),
    // Mesmo indicador do mês atual, só que do mês anterior inteiro — usado
    // só pra calcular a comparação percentual mostrada nos cards do topo.
    rpcCacheado(supabase, usuarioId, "indicadores_financeiros_por_provedor", {
      p_empresa_id: empresaSelecionada,
      p_data_inicio: paraDataISO(inicioMesAnterior),
      p_data_fim: paraDataISO(fimMesAnterior),
    }),
    rpcCacheado(supabase, usuarioId, "dashboard_evolucao_mensal", {
      p_empresa_id: empresaSelecionada,
      p_data_inicio: paraDataISO(seisMesesAtras),
    }),
    // Sempre em nível de rede (compara clientes entre si), independente do
    // cliente selecionado no seletor do topo — por isso não recebe
    // p_empresa_id.
    rpcCacheado(supabase, usuarioId, "dashboard_top_clientes_gasto", {
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
      } = await obterUsuarioAtual();
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
    { data: eficienciaVeiculos },
    { data: rendimentoCorrigido },
  ] = grupo2
    ? await Promise.all([grupo2[0], grupo2[1], grupo2[8], grupo2[10]])
    : [{ data: null, error: null }, { data: null }, { data: null }, { data: null }];
  // Os outros 7 indicadores (painéis avançados) NÃO bloqueiam a página: viram
  // uma promessa lida dentro de <SecaoIndicadoresAvancados> sob Suspense.
  const promessaAvancados = grupo2
    ? Promise.all([grupo2[2], grupo2[3], grupo2[4], grupo2[5], grupo2[6], grupo2[7], grupo2[9], grupo2[11]])
    : null;

  const totaisCentroCusto = (indicadoresCentroCusto ?? []).reduce(
    (acc, c) => ({
      veiculos: acc.veiculos + (c.qtd_veiculos ?? 0),
      abastecimento: acc.abastecimento + (c.custo_abastecimento ?? 0),
      manutencao: acc.manutencao + (c.custo_manutencao ?? 0),
    }),
    { veiculos: 0, abastecimento: 0, manutencao: 0 }
  );

  const manutencaoKpis = manutencaoKpisRows?.[0];

  // Indicador 8 — Eficiência real por veículo: km rodado e km/L calculados a
  // partir de hodômetros consecutivos reais dos abastecimentos (não de rota
  // planejada/sugerida — essa parte do painel de referência foi
  // deliberadamente deixada de fora por não termos dado de GPS real).
  const rendimentoPorPlaca = new Map((rendimentoCorrigido ?? []).map((r) => [r.placa, r]));
  const itensEficienciaVeiculos: ItemEficienciaVeiculo[] = (eficienciaVeiculos ?? []).map((v) => {
    const rc = rendimentoPorPlaca.get(v.placa);
    return {
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      abastecimentos: v.abastecimentos,
      kmTotal: v.km_total,
      kmMedio: v.km_medio,
      // km/L CORRIGIDO (expurgo estatístico). Sem intervalo válido => null ("dados insuficientes").
      mediaKmL: rc ? rc.km_l_corrigido : null,
      kmLBruto: v.media_km_l,
      confianca: rc?.confianca ?? "insuficiente",
      coberturaPct: rc?.cobertura_pct ?? null,
      intervalosValidos: rc?.intervalos_validos ?? 0,
      intervalos: rc?.intervalos ?? 0,
      litrosTotal: v.litros_total,
      precoMedio: v.preco_medio,
      custoTotal: v.custo_total,
    };
  });

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


  // Fase UX-Navegacao (27/08/2026) — painéis ocultos pelo próprio usuário
  // (ver ConfigPaineis.tsx). Falha na leitura já retorna [] (ver
  // preferenciasActions.ts), então na pior hipótese mostra todos os painéis.
  const paineisOcultos = await paineisOcultosPromise;
  const paineisOcultosSet = new Set(paineisOcultos);
  // Fase Auditoria-UX (08/09/2026, pedido do Daniel: ajustes recomendados
  // numa auditoria de UX — "página muito longa/densa, só os 9 painéis
  // avançados são ocultáveis") — mesmo mecanismo do ConfigPaineis acima
  // (chave livre em paineis_ocultos, sem whitelist no banco), agora também
  // cobrindo as seções "fixas" do resumo (entre os 6 indicadores do topo —
  // que continuam SEMPRE visíveis, são o essencial — e os indicadores
  // avançados). Cada usuário decide o que quer ver toda vez que abre o
  // dashboard, sem precisar rolar por seções que não usa.
  const opcoesResumo: OpcaoPainel[] = [
    { chave: "dashboard.destaque_mes", titulo: "Destaque do mês (melhor km/L)" },
    { chave: "dashboard.meios_pagamento", titulo: "Meios de pagamento no mês" },
    { chave: "dashboard.ajustes_abastecimento", titulo: "Ajustes de abastecimento" },
    { chave: "dashboard.consumo_grafico", titulo: "Consumo e gasto — últimos 6 meses" },
    { chave: "dashboard.cnh_vencendo", titulo: "CNH vencendo em 30 dias" },
    { chave: "dashboard.top_clientes", titulo: "Top 5 clientes por gasto" },
    { chave: "dashboard.centro_custo", titulo: "Desempenho por centro de custo" },
    { chave: "dashboard.manutencao_preditiva", titulo: "Manutenção preditiva" },
  ];
  const opcoesPaineis: OpcaoPainel[] = [
    { chave: "dashboard.variacao_precos", titulo: "1. Variação de preços por combustível" },
    { chave: "dashboard.consumo_diario", titulo: "2. Previsão de consumo" },
    { chave: "dashboard.evolucao_preco_medio", titulo: "3. Evolução do preço médio" },
    { chave: "dashboard.volume_postos", titulo: "4. Evolutivo de volume por posto" },
    { chave: "dashboard.ranking_top5", titulo: "5. Top 5 postos" },
    { chave: "dashboard.ranking_veiculos", titulo: "6. Ranking de veículos" },
    { chave: "dashboard.ranking_motoristas", titulo: "7. Ranking de motoristas" },
    { chave: "dashboard.eficiencia_veiculos", titulo: "8. Eficiência real por veículo" },
    { chave: "dashboard.desempenho_por_ativo", titulo: "9. Desempenho por marca/modelo/motor" },
    { chave: "dashboard.saving_anp", titulo: "10. Preço pago vs. referência ANP" },
  ];

  return (
    <div>
      <CabecalhoPagina
        titulo={`${saudacao}${primeiroNome ? `, ${primeiroNome}` : ""}`}
        descricao="Aqui está o resumo da sua frota hoje."
      />

      <CampoPerguntaFni
        empresaId={empresaSelecionada}
        sugestoes={[
          "Qual a previsão de custo com combustível até o fim do mês?",
          "Quais veículos gastam acima da média este mês?",
          "Quais multas estão em aberto?",
        ]}
      />

      <div className="mb-6 card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cliente e período</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direciona os indicadores da frota abaixo pelo cliente selecionado (motoristas, veículos,
              consumo, CNH, centro de custo e indicadores avançados). &quot;Clientes ativos&quot; e
              &quot;Top 5 clientes por gasto&quot; continuam sempre em nível de rede.
            </p>
          </div>
          <form className="flex items-end gap-2">
            {combustivelSelecionado && <input type="hidden" name="combustivel" value={combustivelSelecionado} />}
            {empresas.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Cliente</label>
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
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Período</label>
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
          totalCentrosCusto={totalCentrosCusto ?? 0}
          totalVinculosEquipe={totalVinculosEquipe ?? 0}
        />
      )}

      <div className="mb-2 flex justify-end">
        <ConfigPaineis opcoes={opcoesResumo} ocultosIniciais={paineisOcultos} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <IndicadorColorido cor="violet" icon={Building2} label="Clientes ativos" valor={String(clientesAtivos ?? 0)} sub={`de ${totalClientes ?? 0}`} ajudaChave="dashboard.clientes_ativos" />
        <IndicadorColorido cor="sky" icon={Users} label="Motoristas ativos" valor={String(motoristasAtivos ?? 0)} sub={`de ${totalMotoristas ?? 0}`} ajudaChave="dashboard.motoristas_veiculos_ativos" />
        <IndicadorColorido cor="sky" icon={Truck} label="Veículos ativos" valor={String(veiculosAtivos ?? 0)} sub={`de ${totalVeiculos ?? 0}`} ajudaChave="dashboard.motoristas_veiculos_ativos" />
        <IndicadorColorido cor="green" icon={Droplet} label="Litros no mês" valor={litrosMes.toLocaleString("pt-BR")} delta={deltaLitros} ajudaChave="dashboard.litros_mes" />
        <IndicadorColorido cor="amber" icon={Wallet} label="Valor no mês" valor={formatarMoeda(valorMes)} delta={deltaValor} ajudaChave="dashboard.valor_mes" />
        <IndicadorColorido cor="red" icon={AlertTriangle} label="Custo médio/litro" valor={formatarMoeda(custoMedioLitroMes)} delta={deltaCustoMedio} ajudaChave="dashboard.custo_medio_litro" />
      </div>

      {!paineisOcultosSet.has("dashboard.destaque_mes") && empresaSelecionada && veiculoDestaque && veiculoDestaque.mediaKmL != null && (
        <div className="mb-6 card flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-frota-500">
            <Trophy className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Destaque do mês: a placa <span className="font-medium text-slate-900 dark:text-slate-100">{veiculoDestaque.placa}</span> teve
            o melhor km/L da frota ({veiculoDestaque.mediaKmL.toFixed(2)} km/l)
            {percentualAcimaMedia != null && percentualAcimaMedia > 0 && <>, {percentualAcimaMedia}% acima da média</>}.
          </p>
        </div>
      )}

      {!paineisOcultosSet.has("dashboard.meios_pagamento") && empresaSelecionada && listaProvedoresMes.length > 0 && (
        <div className="mb-6 card p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            Meios de pagamento no mês
          </p>
          <GraficoMeiosPagamentoLazy dados={listaProvedoresMes.map(([provedor, valor]) => ({ provedor, valor }))} />
        </div>
      )}

      {!paineisOcultosSet.has("dashboard.ajustes_abastecimento") && resumoAjustes && (
        <SecaoAjustesAbastecimentos
          pendentes={resumoAjustes.pendentes}
          aceitosNoPeriodo={resumoAjustes.aceitosNoPeriodo}
          impactoFinanceiro={resumoAjustes.impactoFinanceiro}
          ultimosAjustes={resumoAjustes.ultimosAjustes}
          diasPeriodo={JANELA_AJUSTES_DIAS}
        />
      )}

      {(!paineisOcultosSet.has("dashboard.consumo_grafico") || !paineisOcultosSet.has("dashboard.cnh_vencendo")) && (
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {!paineisOcultosSet.has("dashboard.consumo_grafico") && (
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Consumo e gasto — últimos 6 meses <AjudaIcon chave="dashboard.consumo_grafico" />
          </h2>
          <GraficoConsumoLazy dados={dadosGrafico} />
        </div>
        )}

        {!paineisOcultosSet.has("dashboard.cnh_vencendo") && (
        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
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
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
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
        )}
      </div>
      )}

      {!paineisOcultosSet.has("dashboard.top_clientes") && (
      <div className="mb-6 card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Top 5 clientes por gasto (últimos 6 meses) <AjudaIcon chave="dashboard.top_clientes" />
        </h2>
        {topClientes.length > 0 ? (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2">Cliente</th>
                <th className="py-2">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {topClientes.map((c) => (
                <tr key={c.nome}>
                  <td className="py-2 text-slate-700 dark:text-slate-300">{c.nome}</td>
                  <td className="py-2 text-slate-700 dark:text-slate-300">{formatarMoeda(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Ainda não há abastecimentos vinculados a um cliente.</p>
        )}
      </div>
      )}

      {!paineisOcultosSet.has("dashboard.centro_custo") && (
      <div className="card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Desempenho por centro de custo <AjudaIcon chave="dashboard.centro_custo" />
        </h2>

        {!empresaSelecionada && (
          <p className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            Selecione um cliente no seletor do topo da página para ver os indicadores dos centros de custo dele.
          </p>
        )}

        {empresaSelecionada && erroCentroCusto && (
          <p className="text-sm text-red-600">Erro ao carregar indicadores: {erroCentroCusto.message}</p>
        )}

        {empresaSelecionada && !erroCentroCusto && (
          <>
            {nomeEmpresaSelecionada && (
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Cliente: <span className="font-medium text-slate-700 dark:text-slate-300">{nomeEmpresaSelecionada}</span> ·{" "}
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
                  <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Centro de custo</th>
                      <th className="py-2 pr-4">Veículos</th>
                      <th className="py-2 pr-4">Custo abastecimento</th>
                      <th className="py-2 pr-4">Custo manutenção</th>
                      <th className="py-2 pr-4">Custo total/km</th>
                      <th className="py-2">Consumo médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
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
                        <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300">{c.qtd_veiculos}</td>
                        <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300">{formatarMoeda(c.custo_abastecimento ?? 0)}</td>
                        <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300">{formatarMoeda(c.custo_manutencao ?? 0)}</td>
                        <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300">
                          {c.custo_por_km != null ? `R$ ${c.custo_por_km.toFixed(3)}` : "—"}
                        </td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300">
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
      )}

      {!paineisOcultosSet.has("dashboard.manutencao_preditiva") && empresaSelecionada && manutencaoKpis && (
        <div className="mt-6 card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Indicadores avançados</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Preços, consumo e rankings do período selecionado no topo da página.</p>
          </div>
          {/* Fase Dashboard-Filtro-Combustivel (19/07) — pedido do Daniel:
              seletor de combustível pros indicadores 2 (previsão de
              consumo), 3 (evolução do preço médio) e 4/5 (volume por
              posto). Campos ocultos preservam cliente/período já
              selecionados no topo da página (senão o submit deste form
              perderia esses filtros). */}
          <div className="flex items-end gap-2">
            <ConfigPaineis opcoes={opcoesPaineis} ocultosIniciais={paineisOcultos} />
            {empresaSelecionada && (
              <form className="flex items-end gap-2">
                <input type="hidden" name="empresa" value={empresaSelecionada} />
                <input type="hidden" name="mesAno" value={`${indAno}-${indMes}`} />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Combustível</label>
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
        </div>

        {!empresaSelecionada && (
          <p className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
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
            <Suspense fallback={<FallbackAvancados />}>
              <SecaoIndicadoresAvancados
                promessa={promessaAvancados!}
                paineisOcultos={Array.from(paineisOcultosSet)}
                opcoesMes={opcoesMes}
                indAno={indAno}
                indMes={indMes}
                diasNoMes={diasNoMes}
                diaAtual={diaAtual}
                isMesAtual={isMesAtual}
                isMesFuturo={isMesFuturo}
                itensEficienciaVeiculos={itensEficienciaVeiculos}
              />
            </Suspense>
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
    <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{valor}</p>
    </div>
  );
}
