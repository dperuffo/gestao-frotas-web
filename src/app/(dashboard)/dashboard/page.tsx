import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { calcularPrevisaoConsumo } from "@/lib/previsaoConsumo";
import { GraficoConsumo, type PontoConsumo } from "./_components/GraficoConsumo";
import { GraficoVariacaoPrecos } from "./_components/GraficoVariacaoPrecos";
import { GraficoPrevisaoConsumo } from "./_components/GraficoPrevisaoConsumo";
import { GraficoEvolucaoPrecoMedio } from "./_components/GraficoEvolucaoPrecoMedio";
import { GraficoEvolutivoPostos, type PontoEvolutivoPostos } from "./_components/GraficoEvolutivoPostos";
import { GraficoTopPostos } from "./_components/GraficoTopPostos";
import { RankingGasto, type ItemRankingGasto } from "./_components/RankingGasto";
import { GraficoEficienciaVeiculos, type ItemEficienciaVeiculo } from "./_components/GraficoEficienciaVeiculos";
import { PrimeirosPassos } from "./_components/PrimeirosPassos";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

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

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type SearchParams = { empresa?: string; mesAno?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, mesAno: mesAnoParam } = await searchParams;
  const supabase = await createClient();
  const agora = new Date();
  const inicioMesAtual = inicioDoMes(agora);
  const seisMesesAtras = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  const daqui30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Cliente e período do seletor único do topo — resolvido antes das
  // demais consultas pra poder filtrar por ele os indicadores operacionais
  // (motoristas, veículos, litros/valor/custo, CNH vencendo, gráfico de
  // consumo). "Clientes ativos" e "Top 5 clientes por gasto" continuam em
  // nível de rede (comparam clientes entre si — não faz sentido escopar a
  // um só cliente).
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

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
    { data: abastecimentosRecentes },
    { data: veiculosDaEmpresa },
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
    supabase
      .from("profrotas_abastecimentos")
      .select("data_abastecimento, item_quantidade, item_valor_total, empresa_id")
      .gte("data_abastecimento", seisMesesAtras.toISOString())
      .limit(5000),
    // cadastro_veiculos não tem empresa_id — o vínculo é por cnpj_frota,
    // comparado com empresas.cnpj de forma normalizada (só alfanuméricos,
    // maiúsculo). Comparar direto via .eq("cnpj_frota", empresas.cnpj)
    // falha sempre que um dos dois lados vem formatado diferente do outro
    // (achado real: empresas.cnpj sempre pontuado, cadastro_veiculos com
    // registros pontuados e não pontuados misturados) — por isso usamos a
    // RPC `veiculos_da_empresa`, que resolve isso no banco com a mesma
    // normalização já usada pela RLS via `empresa_id_do_cnpj`.
    empresaSelecionada
      ? supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaSelecionada })
      : Promise.resolve({ data: null }),
  ]);

  const totalVeiculos = empresaSelecionada ? (veiculosDaEmpresa ?? []).length : totalVeiculosGlobal;
  const veiculosAtivos = empresaSelecionada
    ? (veiculosDaEmpresa ?? []).filter((v) => v.ativo).length
    : veiculosAtivosGlobal;

  // Abastecimentos usados nos cards e no gráfico de consumo respeitam o
  // cliente selecionado; o array bruto (sem filtro) continua disponível
  // pra alimentar o Top 5 clientes por gasto, que compara clientes entre si.
  const abastecimentosCliente = empresaSelecionada
    ? (abastecimentosRecentes ?? []).filter((a) => a.empresa_id === empresaSelecionada)
    : (abastecimentosRecentes ?? []);

  // Indicadores do mês atual, calculados em memória a partir dos últimos 6 meses já buscados.
  const doMesAtual = abastecimentosCliente.filter(
    (a) => a.data_abastecimento && new Date(a.data_abastecimento) >= inicioMesAtual
  );
  const litrosMes = doMesAtual.reduce((soma, a) => soma + (a.item_quantidade ?? 0), 0);
  const valorMes = doMesAtual.reduce((soma, a) => soma + (a.item_valor_total ?? 0), 0);
  const custoMedioLitroMes = litrosMes > 0 ? valorMes / litrosMes : 0;

  // Gráfico: agrupa por mês (últimos 6 meses).
  const porMes = new Map<string, PontoConsumo>();
  for (let i = 5; i >= 0; i--) {
    const data = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    porMes.set(chave, { mes: rotuloMes(data), litros: 0, valor: 0 });
  }
  for (const a of abastecimentosCliente) {
    if (!a.data_abastecimento) continue;
    const data = new Date(a.data_abastecimento);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    const ponto = porMes.get(chave);
    if (ponto) {
      ponto.litros += a.item_quantidade ?? 0;
      ponto.valor += a.item_valor_total ?? 0;
    }
  }
  const dadosGrafico = Array.from(porMes.values()).map((p) => ({ ...p, litros: Math.round(p.litros) }));

  // Top 5 clientes por gasto (últimos 6 meses) — sempre em nível de rede,
  // usa o array sem filtro de cliente mesmo com um cliente selecionado.
  const gastoPorEmpresa = new Map<string, number>();
  for (const a of abastecimentosRecentes ?? []) {
    if (!a.empresa_id) continue;
    gastoPorEmpresa.set(a.empresa_id, (gastoPorEmpresa.get(a.empresa_id) ?? 0) + (a.item_valor_total ?? 0));
  }
  const idsTop = Array.from(gastoPorEmpresa.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
  const { data: empresasTop } = idsTop.length
    ? await supabase.from("empresas").select("id, nome").in("id", idsTop)
    : { data: [] };
  const nomePorEmpresaId = new Map((empresasTop ?? []).map((e) => [e.id, e.nome]));
  const topClientes = idsTop.map((id) => ({ nome: nomePorEmpresaId.get(id) ?? id, valor: gastoPorEmpresa.get(id)! }));

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

  // Indicadores por centro de custo — mesmo cliente e mês selecionados acima.
  const { data: indicadoresCentroCusto, error: erroCentroCusto } = empresaSelecionada
    ? await supabase.rpc("indicadores_centro_custo", {
        p_empresa_id: empresaSelecionada,
        p_data_inicio: dataInicioInd,
        p_data_fim: dataFimInd,
      })
    : { data: null, error: null };

  const totaisCentroCusto = (indicadoresCentroCusto ?? []).reduce(
    (acc, c) => ({
      veiculos: acc.veiculos + (c.qtd_veiculos ?? 0),
      abastecimento: acc.abastecimento + (c.custo_abastecimento ?? 0),
      manutencao: acc.manutencao + (c.custo_manutencao ?? 0),
    }),
    { veiculos: 0, abastecimento: 0, manutencao: 0 }
  );

  // Manutenção preditiva — mesmo cliente selecionado acima, indicadores
  // agregados (não a lista inteira) vindos de manutencao_preditiva_kpis.
  const { data: manutencaoKpisRows } = empresaSelecionada
    ? await supabase.rpc("manutencao_preditiva_kpis", { p_empresa_id: empresaSelecionada })
    : { data: null };
  const manutencaoKpis = manutencaoKpisRows?.[0];

  const [
    { data: variacaoPrecos },
    { data: consumoDiario },
    { data: padraoDiaSemanaRows },
    { data: volumePostos },
    { data: rankingVeiculos },
    { data: rankingMotoristas },
    { data: eficienciaVeiculos },
  ] = empresaSelecionada
    ? await Promise.all([
        supabase.rpc("indicador_variacao_precos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        supabase.rpc("indicador_consumo_diario", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
        }),
        supabase.rpc("indicador_padrao_dia_semana", { p_empresa_id: empresaSelecionada, p_dias_lookback: 90 }),
        supabase.rpc("indicador_volume_postos", {
          p_empresa_id: empresaSelecionada,
          p_data_inicio: dataInicioInd,
          p_data_fim: dataFimInd,
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
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }, { data: null }, { data: null }, { data: null }];

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
  const postosNomes = Array.from(new Set((volumePostos ?? []).map((v) => v.posto_nome ?? v.posto_cnpj)));
  const porDiaPostos = new Map<string, PontoEvolutivoPostos>();
  const totalPorPosto = new Map<string, number>();
  for (const v of volumePostos ?? []) {
    const nome = v.posto_nome ?? v.posto_cnpj;
    const diaLabel = new Date(`${v.dia}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const ponto = porDiaPostos.get(diaLabel) ?? { diaLabel };
    ponto[nome] = v.litros;
    porDiaPostos.set(diaLabel, ponto);
    totalPorPosto.set(nome, (totalPorPosto.get(nome) ?? 0) + v.litros);
  }
  const dadosEvolutivoPostos = Array.from(porDiaPostos.values());
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Visão geral da frota.</p>
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

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador label="Clientes ativos" valor={String(clientesAtivos ?? 0)} sub={`de ${totalClientes ?? 0}`} ajudaChave="dashboard.clientes_ativos" />
        <Indicador label="Motoristas ativos" valor={String(motoristasAtivos ?? 0)} sub={`de ${totalMotoristas ?? 0}`} ajudaChave="dashboard.motoristas_veiculos_ativos" />
        <Indicador label="Veículos ativos" valor={String(veiculosAtivos ?? 0)} sub={`de ${totalVeiculos ?? 0}`} ajudaChave="dashboard.motoristas_veiculos_ativos" />
        <Indicador label="Litros no mês" valor={litrosMes.toLocaleString("pt-BR")} ajudaChave="dashboard.litros_mes" />
        <Indicador label="Valor no mês" valor={formatarMoeda(valorMes)} ajudaChave="dashboard.valor_mes" />
        <Indicador label="Custo médio/litro" valor={formatarMoeda(custoMedioLitroMes)} ajudaChave="dashboard.custo_medio_litro" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            Consumo e gasto — últimos 6 meses <AjudaIcon chave="dashboard.consumo_grafico" />
          </h2>
          <GraficoConsumo dados={dadosGrafico} />
        </div>

        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            CNH vencendo em 30 dias <AjudaIcon chave="dashboard.cnh_vencendo" />
          </h2>
          {cnhVencendo && cnhVencendo.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {cnhVencendo.map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  <Link href={`/motoristas/${m.id}`} className="text-frota-600 hover:underline">
                    {m.nome_completo}
                  </Link>
                  <span className="badge-atencao">{formatDate(m.cnh_vencimento)}</span>
                </li>
              ))}
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Indicadores avançados</h2>
          <p className="text-sm text-slate-500">Preços, consumo e rankings do período selecionado no topo da página.</p>
        </div>

        {!empresaSelecionada && (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Selecione um cliente no seletor do topo da página para ver os indicadores avançados dele.
          </p>
        )}

        {empresaSelecionada && (
          <div className="space-y-6">
            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">1. Variação de preços por combustível <AjudaIcon chave="dashboard.variacao_precos" /></h3>
              <p className="mb-3 text-xs text-slate-500">
                Faixa de preço paga na rede do cliente, comparada à referência ANP do estado mais frequente.
              </p>
              <GraficoVariacaoPrecos dados={variacaoPrecos ?? []} />
            </div>

            <div className="card p-4">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">2. Previsão de consumo — {opcoesMes.find((o) => o.ano === indAno && o.mes === indMes)?.label} <AjudaIcon chave="dashboard.consumo_diario" /></h3>
              <p className="mb-3 text-xs text-slate-500">
                Litros por dia; dias restantes do mês projetados com base no padrão de consumo por dia da semana
                (últimos 90 dias).
              </p>
              <GraficoPrevisaoConsumo dados={dadosPrevisaoConsumo} />
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
              <GraficoEvolucaoPrecoMedio dados={dadosPrecoMedio} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">4. Evolutivo de volume — Top 5 postos <AjudaIcon chave="dashboard.volume_postos" /></h3>
                <GraficoEvolutivoPostos dados={dadosEvolutivoPostos} postos={postosNomes} />
              </div>
              <div className="card p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">5. Top 5 postos — maior volume no período <AjudaIcon chave="dashboard.ranking_top5" /></h3>
                <GraficoTopPostos dados={dadosTopPostos} />
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
                KM rodado e km/L calculados a partir de hodômetros consecutivos reais dos abastecimentos da
                integração PróFrotas. Não inclui comparação com rota planejada — sem dado real de GPS/trajetória,
                essa parte não é confiável para exibir aqui.
              </p>
              <GraficoEficienciaVeiculos dados={itensEficienciaVeiculos} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Indicador({
  label,
  valor,
  sub,
  ajudaChave,
}: {
  label: string;
  valor: string;
  sub?: string;
  ajudaChave?: string;
}) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function MiniIndicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
