import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarDataBr } from "@/lib/utils";
import { STATUS_NEGOCIACAO_LABEL, type StatusNegociacao } from "@/lib/negociacoesPostos";
import { GraficoEvolutivoPostos, type PontoEvolutivoPostos } from "./GraficoEvolutivoPostos";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const JANELA_DESEMPENHO_DIAS = 30;
// Só os últimos 14 dias entram no gráfico diário — 30 dias com 1 linha por
// combustível já fica ilegível num gráfico desse tamanho.
const JANELA_GRAFICO_DIAS = 14;

// Fase 27.56 — Dashboard do posto revendedor (segmento "Revenda").
//
// Achado real: todo mundo cai em /dashboard depois do login (ver
// src/app/login/actions.ts), mas essa página sempre foi 100% voltada pra
// Frota (veículos, motoristas, previsão de consumo, ranking de gasto) — um
// usuário posto nunca tinha nada relevante ali, e o item nem aparece no
// menuPosto. Esta é a versão pro lado Revenda: indicadores e negociações a
// partir de negociacoes_postos, que o posto já enxerga integralmente via
// RLS (sem precisar de nenhuma tabela ou política nova).
export async function DashboardPosto({
  empresaPostoId,
  nomeEmpresaSelecionada,
}: {
  empresaPostoId: string;
  nomeEmpresaSelecionada?: string;
}) {
  const supabase = await createClient();
  const hojeIso = new Date().toISOString().slice(0, 10);

  const [{ count: pendentes }, { count: vigentes }, { data: negociacoes }] = await Promise.all([
    supabase
      .from("negociacoes_postos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_posto_id", empresaPostoId)
      .eq("status", "pendente_posto"),
    supabase
      .from("negociacoes_postos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_posto_id", empresaPostoId)
      .eq("status", "aceita")
      .lte("vigencia_inicio", hojeIso)
      .gte("vigencia_fim", hojeIso),
    supabase
      .from("negociacoes_postos")
      .select(
        "id, status, cliente_nome, combustivel, vigencia_inicio, vigencia_fim, volume_minimo_mensal, preco_unitario, atualizado_em"
      )
      .eq("empresa_posto_id", empresaPostoId)
      .order("atualizado_em", { ascending: false })
      .limit(200),
  ]);

  const listaNegociacoes = negociacoes ?? [];
  const clientesAtivos = new Set(
    listaNegociacoes.filter((n) => n.status === "aceita").map((n) => n.cliente_nome ?? "")
  ).size;
  const volumeContratado = listaNegociacoes
    .filter(
      (n) =>
        n.status === "aceita" &&
        n.vigencia_inicio !== null &&
        n.vigencia_fim !== null &&
        n.vigencia_inicio <= hojeIso &&
        n.vigencia_fim >= hojeIso
    )
    .reduce((soma, n) => soma + (n.volume_minimo_mensal ?? 0), 0);

  const vigentesLista = listaNegociacoes
    .filter(
      (n) =>
        n.status === "aceita" &&
        n.vigencia_inicio !== null &&
        n.vigencia_fim !== null &&
        n.vigencia_inicio <= hojeIso &&
        n.vigencia_fim >= hojeIso
    )
    .slice(0, 10);

  // Fase 27.60 — indicadores de desempenho de venda, a partir dos
  // abastecimentos que este posto forneceu (mesma fonte/filtro de
  // AbastecimentosPosto: profrotas_abastecimentos.pv_cnpj = CNPJ deste
  // posto — populado pelo robô e, no futuro, por uma integração real).
  const { data: empresaPosto } = await supabase.from("empresas").select("cnpj").eq("id", empresaPostoId).maybeSingle();
  const desdeIso = new Date(Date.now() - JANELA_DESEMPENHO_DIAS * 24 * 60 * 60 * 1000).toISOString();

  let vendas: {
    item_nome: string | null;
    item_quantidade: number | null;
    item_valor_total: number | null;
    data_abastecimento: string | null;
  }[] = [];

  if (empresaPosto?.cnpj) {
    const { data } = await supabase
      .from("profrotas_abastecimentos")
      .select("item_nome, item_quantidade, item_valor_total, data_abastecimento")
      .eq("pv_cnpj", empresaPosto.cnpj)
      .gte("data_abastecimento", desdeIso)
      .order("data_abastecimento", { ascending: true })
      .limit(5000);
    vendas = data ?? [];
  }

  const volumeVendido = vendas.reduce((soma, v) => soma + (v.item_quantidade ?? 0), 0);
  const receitaVendida = vendas.reduce((soma, v) => soma + (v.item_valor_total ?? 0), 0);
  const precoMedioGeral = volumeVendido > 0 ? receitaVendida / volumeVendido : 0;
  const ticketMedio = vendas.length > 0 ? receitaVendida / vendas.length : 0;

  // Desempenho por combustível: volume, receita, preço médio e % do
  // volume total — ordenado do combustível mais vendido pro menos.
  const porCombustivel = new Map<string, { volume: number; receita: number }>();
  for (const v of vendas) {
    const nome = v.item_nome ?? "—";
    const acumulado = porCombustivel.get(nome) ?? { volume: 0, receita: 0 };
    acumulado.volume += v.item_quantidade ?? 0;
    acumulado.receita += v.item_valor_total ?? 0;
    porCombustivel.set(nome, acumulado);
  }
  const desempenhoPorCombustivel = Array.from(porCombustivel.entries())
    .map(([combustivel, { volume, receita }]) => ({
      combustivel,
      volume,
      receita,
      precoMedio: volume > 0 ? receita / volume : 0,
      participacao: volumeVendido > 0 ? (volume / volumeVendido) * 100 : 0,
    }))
    .sort((a, b) => b.volume - a.volume);

  // Venda diária por combustível (últimos JANELA_GRAFICO_DIAS dias) — 1
  // linha por combustível, reaproveitando o mesmo gráfico multi-série já
  // usado pra "evolução por posto" na tela do cliente (GraficoEvolutivoPostos
  // é genérico o bastante: só espera {diaLabel, [série]: valor}).
  const combustiveisNoPeriodo = Array.from(porCombustivel.keys());
  // Fase 27.62 — achado real (reportado pelo Daniel, gráfico sempre em
  // zero): a janela ia de "hoje - 14 dias" até "hoje - 14 dias + 13", ou
  // seja, terminava ONTEM — o dia de hoje (onde o robô acabou de gerar os
  // abastecimentos) nunca entrava no gráfico. Corrigido pra terminar HOJE
  // (inclusive) e começar 13 dias atrás — 14 dias no total, sempre com hoje
  // como o último ponto.
  const diasGrafico: string[] = [];
  for (let i = JANELA_GRAFICO_DIAS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    diasGrafico.push(d.toISOString().slice(0, 10));
  }
  const volumePorDiaCombustivel = new Map<string, Map<string, number>>();
  for (const v of vendas) {
    if (!v.data_abastecimento) continue;
    const dia = v.data_abastecimento.slice(0, 10);
    if (dia < diasGrafico[0]) continue;
    const nome = v.item_nome ?? "—";
    const porDia = volumePorDiaCombustivel.get(dia) ?? new Map<string, number>();
    porDia.set(nome, (porDia.get(nome) ?? 0) + (v.item_quantidade ?? 0));
    volumePorDiaCombustivel.set(dia, porDia);
  }
  const dadosGraficoDiario: PontoEvolutivoPostos[] = diasGrafico.map((dia) => {
    const porDia = volumePorDiaCombustivel.get(dia);
    const ponto: PontoEvolutivoPostos = {
      diaLabel: formatarDataBr(dia).slice(0, 5), // "dd/mm"
    };
    for (const combustivel of combustiveisNoPeriodo) {
      ponto[combustivel] = porDia?.get(combustivel) ?? 0;
    }
    return ponto;
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Desempenho de vendas e negociações{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/abastecimentos" className="btn-secondary">
            Ver abastecimentos
          </Link>
          <Link href="/negociacoes" className="btn-primary">
            Ver negociações
          </Link>
        </div>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Desempenho de vendas — últimos {JANELA_DESEMPENHO_DIAS} dias
      </p>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Indicador label="Abastecimentos" valor={vendas.length.toLocaleString("pt-BR")} />
        <Indicador label="Volume transacionado" valor={`${volumeVendido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
        <Indicador label="Receita total" valor={formatarMoeda(receitaVendida)} />
        <Indicador label="Preço médio praticado" valor={formatarMoeda(precoMedioGeral)} />
        <Indicador label="Ticket médio" valor={formatarMoeda(ticketMedio)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Desempenho por combustível</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Combustível</th>
                <th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">Preço médio</th>
                <th className="px-4 py-3">Receita</th>
                <th className="px-4 py-3">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {desempenhoPorCombustivel.map((d) => (
                <tr key={d.combustivel} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{d.combustivel}</td>
                  <td className="px-4 py-3 text-slate-500">{d.volume.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L</td>
                  <td className="px-4 py-3 text-slate-500">{formatarMoeda(d.precoMedio)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatarMoeda(d.receita)}</td>
                  <td className="px-4 py-3 text-slate-500">{d.participacao.toFixed(0)}%</td>
                </tr>
              ))}
              {desempenhoPorCombustivel.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Nenhum abastecimento no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Venda diária por combustível (L)</h2>
          </div>
          <div className="p-2">
            <GraficoEvolutivoPostos dados={dadosGraficoDiario} postos={combustiveisNoPeriodo} />
          </div>
        </div>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Negociações</p>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Aguardando sua resposta" valor={String(pendentes ?? 0)} />
        <Indicador label="Negociações vigentes" valor={String(vigentes ?? 0)} />
        <Indicador label="Clientes com negociação aceita" valor={String(clientesAtivos)} />
        <Indicador
          label="Volume mín. contratado/mês"
          valor={`${volumeContratado.toLocaleString("pt-BR")} L`}
        />
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Negociações vigentes agora</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Vigência</th>
              <th className="px-4 py-3">Volume mín./mês</th>
              <th className="px-4 py-3">Preço/L</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vigentesLista.map((n) => (
              <tr key={n.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{n.cliente_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{n.combustivel ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {n.vigencia_inicio && n.vigencia_fim
                    ? `${formatarDataBr(n.vigencia_inicio)} – ${formatarDataBr(n.vigencia_fim)}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {n.volume_minimo_mensal != null ? `${n.volume_minimo_mensal.toLocaleString("pt-BR")} L` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {n.preco_unitario != null
                    ? n.preco_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/negociacoes/${n.id}`} className="text-frota-600 hover:underline">
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
            {vigentesLista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma negociação vigente no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {listaNegociacoes.some((n) => n.status === "pendente_posto") && (
        <div className="mt-6 card overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Aguardando sua resposta</h2>
          </div>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {listaNegociacoes
                .filter((n) => n.status === "pendente_posto")
                .slice(0, 10)
                .map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{n.cliente_nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {STATUS_NEGOCIACAO_LABEL[n.status as StatusNegociacao] ?? n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/negociacoes/${n.id}`} className="text-frota-600 hover:underline">
                        Responder
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
