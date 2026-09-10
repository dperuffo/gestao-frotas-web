import Link from "next/link";
import { Users, AlertTriangle, TrendingDown, Ban } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { listarInsightsAcao } from "../insights-ia/actions";
import { CardInsightIA } from "../insights-ia/_components/CardInsightIA";
import { registrarContatoAction } from "./actions";

type SearchParams = { empresa?: string; tab?: string };

const ABAS = ["churn", "score", "preco", "horario", "fuga", "pareto", "mix", "precoregional", "insights"];

const CHURN_STATUS_LABEL: Record<string, string> = {
  em_dia: "Em dia",
  atencao: "Atenção",
  critico: "Crítico",
  sem_historico: "Sem histórico",
  nunca_abasteceu: "Nunca abasteceu aqui",
};

const CHURN_STATUS_CLASSE: Record<string, string> = {
  em_dia: "bg-green-100 text-green-700",
  atencao: "bg-amber-100 text-amber-700",
  critico: "bg-red-100 text-red-700",
  sem_historico: "bg-slate-100 text-slate-600",
  nunca_abasteceu: "bg-slate-100 text-slate-600",
};

const PRECO_STATUS_LABEL: Record<string, string> = {
  sensivel: "Sensível a preço",
  moderado: "Moderadamente sensível",
  estavel: "Estável",
  dados_insuficientes: "Dados insuficientes",
};

const PRECO_STATUS_CLASSE: Record<string, string> = {
  sensivel: "bg-red-100 text-red-700",
  moderado: "bg-amber-100 text-amber-700",
  estavel: "bg-green-100 text-green-700",
  dados_insuficientes: "bg-slate-100 text-slate-600",
};

const FUGA_STATUS_LABEL: Record<string, string> = {
  alerta_fuga: "Alerta de fuga",
  atencao: "Atenção",
  estavel: "Estável",
  sem_dados_suficientes: "Sem dados suficientes",
};

const FUGA_STATUS_CLASSE: Record<string, string> = {
  alerta_fuga: "bg-red-100 text-red-700",
  atencao: "bg-amber-100 text-amber-700",
  estavel: "bg-green-100 text-green-700",
  sem_dados_suficientes: "bg-slate-100 text-slate-600",
};

const PRIORIDADE_LABEL: Record<string, string> = { critico: "Crítico", atencao: "Atenção", saudavel: "Saudável" };
const PRIORIDADE_CLASSE: Record<string, string> = {
  critico: "bg-red-100 text-red-700",
  atencao: "bg-amber-100 text-amber-700",
  saudavel: "bg-green-100 text-green-700",
};

// Fase Inteligência-Comercial-Posto (09/09/2026) — devolutiva pro posto dos
// sinais do próprio histórico de abastecimento, no molde do que já existe pro
// lado frota (Ações Sugeridas, Insights de IA). Fase 1: clientes em risco de
// churn (aba "churn"). Fase 2: sensibilidade a preço, horário de pico e fuga
// de rede (abas "preco"/"horario"/"fuga"). Fase 3 (pedido do Daniel: "vamos
// desenvolver todos" — as 6 melhorias propostas em conversa) acrescenta:
//  - "score": score_saude_comercial_clientes_posto — combina os 3 sinais de
//    risco por cliente (churn + preço + fuga) num único número, pra priorizar
//    quem contatar primeiro sem abrir 3 abas. Tem o botão de "Registrar
//    contato" (contatos_clientes_posto) — fecha o loop de ação.
//  - "pareto": concentracao_receita_clientes_posto — quanto da receita
//    depende dos maiores clientes.
//  - "mix": mix_produto_clientes_posto — quais produtos cada cliente nunca
//    comprou aqui (cross-sell).
//  - "precoregional": posicionamento_preco_posto — o preço que o próprio
//    posto cadastrou comparado à referência ANP da região.
//  - "insights": reaproveita 100% a infraestrutura de Insights de IA que já
//    existe pro lado frota (mesma tabela insights_proativos_ia, mesmo
//    componente CardInsightIA) — só o coletor de sinais é outro
//    (coletar_sinais_insights_ia_posto).
export default async function InteligenciaComercialPostoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, tab: tabParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const tab = ABAS.includes(tabParam ?? "") ? (tabParam as string) : "churn";

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }

  if (empresaSelecionada && segmentoSelecionado !== "Revenda") {
    return <div className="card p-6 text-sm text-slate-600">Esta tela é exclusiva para postos revendedores.</div>;
  }

  const { data: churnData, error: erroChurn } =
    empresaSelecionada && tab === "churn"
      ? await supabase.rpc("clientes_em_risco_churn", { p_empresa_posto_id: empresaSelecionada })
      : { data: null, error: null };
  const clientesChurn = churnData ?? [];

  const { data: precoData, error: erroPreco } =
    empresaSelecionada && tab === "preco"
      ? await supabase.rpc("sensibilidade_preco_clientes_posto", { p_empresa_posto_id: empresaSelecionada })
      : { data: null, error: null };
  const clientesPreco = precoData ?? [];

  const { data: horarioData, error: erroHorario } =
    empresaSelecionada && tab === "horario"
      ? await supabase.rpc("padrao_horario_abastecimento_posto", { p_empresa_posto_id: empresaSelecionada })
      : { data: null, error: null };
  const horarios = [...(horarioData ?? [])].sort((a, b) => (b.ticket_medio ?? 0) - (a.ticket_medio ?? 0));

  const { data: fugaData, error: erroFuga } =
    empresaSelecionada && tab === "fuga"
      ? await supabase.rpc("fuga_de_rede_clientes_posto", { p_empresa_posto_id: empresaSelecionada })
      : { data: null, error: null };
  const clientesFuga = fugaData ?? [];

  const { data: scoreData, error: erroScore } =
    empresaSelecionada && tab === "score"
      ? await supabase.rpc("score_saude_comercial_clientes_posto", { p_empresa_posto_id: empresaSelecionada })
      : { data: null, error: null };
  const clientesScore = scoreData ?? [];

  const { data: contatosData } =
    empresaSelecionada && tab === "score"
      ? await supabase
          .from("contatos_clientes_posto")
          .select("id, empresa_cliente_id, nota, criado_por, criado_em")
          .eq("empresa_posto_id", empresaSelecionada)
          .order("criado_em", { ascending: false })
      : { data: null };
  const contatosPorCliente = new Map<string, { id: string; nota: string; criado_por: string | null; criado_em: string }[]>();
  for (const c of contatosData ?? []) {
    const lista = contatosPorCliente.get(c.empresa_cliente_id) ?? [];
    lista.push(c);
    contatosPorCliente.set(c.empresa_cliente_id, lista);
  }

  const { data: paretoData, error: erroPareto } =
    empresaSelecionada && tab === "pareto"
      ? await supabase.rpc("concentracao_receita_clientes_posto", { p_empresa_posto_id: empresaSelecionada })
      : { data: null, error: null };
  const clientesPareto = paretoData ?? [];

  const { data: mixData, error: erroMix } =
    empresaSelecionada && tab === "mix"
      ? await supabase.rpc("mix_produto_clientes_posto", { p_empresa_posto_id: empresaSelecionada })
      : { data: null, error: null };
  const mix = mixData ?? [];
  const produtosUnicos = Array.from(new Set(mix.map((m) => m.produto)));
  const mixPorCliente = new Map<string, { nome: string; produtos: Map<string, boolean> }>();
  for (const m of mix) {
    if (!mixPorCliente.has(m.empresa_cliente_id)) {
      mixPorCliente.set(m.empresa_cliente_id, { nome: m.nome, produtos: new Map() });
    }
    mixPorCliente.get(m.empresa_cliente_id)!.produtos.set(m.produto, m.comprou);
  }

  const { data: precoRegionalData, error: erroPrecoRegional } =
    empresaSelecionada && tab === "precoregional"
      ? await supabase.rpc("posicionamento_preco_posto", { p_empresa_posto_id: empresaSelecionada })
      : { data: null, error: null };
  const precoRegional = precoRegionalData ?? [];

  const insights =
    empresaSelecionada && tab === "insights" ? await listarInsightsAcao(empresaSelecionada) : [];

  const emDia = clientesChurn.filter((c) => c.status === "em_dia").length;
  const emRisco = clientesChurn.filter((c) => c.status === "atencao" || c.status === "critico").length;
  const criticos = clientesChurn.filter((c) => c.status === "critico").length;
  const nuncaAbasteceram = clientesChurn.filter((c) => c.status === "nunca_abasteceu").length;

  function linkAba(novaAba: string) {
    const sp = new URLSearchParams();
    if (empresaSelecionada) sp.set("empresa", empresaSelecionada);
    sp.set("tab", novaAba);
    return `/inteligencia-comercial-posto?${sp.toString()}`;
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Inteligência Comercial"
        descricao={`Sinais do seu próprio histórico de abastecimento, organizados pra ação comercial${nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.`}
      />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <input type="hidden" name="tab" value={tab} />
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
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { aba: "score", label: "Prioridade" },
              { aba: "churn", label: "Clientes em Risco" },
              { aba: "preco", label: "Sensibilidade a Preço" },
              { aba: "horario", label: "Horário de Pico" },
              { aba: "fuga", label: "Fuga de Rede" },
              { aba: "pareto", label: "Concentração de Receita" },
              { aba: "mix", label: "Mix de Produto" },
              { aba: "precoregional", label: "Preço vs. Região" },
              { aba: "insights", label: "Insights de IA" },
            ].map(({ aba, label }) => (
              <Link
                key={aba}
                href={linkAba(aba)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${tab === aba ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {label}
              </Link>
            ))}
          </div>

          {tab === "score" && (
            <>
              {erroScore && <p className="mb-4 text-sm text-red-600">Erro ao carregar dados: {erroScore.message}</p>}

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Churn</th>
                      <th className="px-4 py-3">Preço</th>
                      <th className="px-4 py-3">Fuga de rede</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Prioridade</th>
                      <th className="px-4 py-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesScore.map((c) => {
                      const contatos = contatosPorCliente.get(c.empresa_cliente_id) ?? [];
                      return (
                        <tr key={c.empresa_cliente_id} className="align-top transition-colors hover:bg-frota-50/60">
                          <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                          <td className="px-4 py-3 text-slate-500">{CHURN_STATUS_LABEL[c.status_churn ?? ""] ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-500">{PRECO_STATUS_LABEL[c.status_preco ?? ""] ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-500">{FUGA_STATUS_LABEL[c.status_fuga ?? ""] ?? "—"}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{c.score}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORIDADE_CLASSE[c.prioridade] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {PRIORIDADE_LABEL[c.prioridade] ?? c.prioridade}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-frota-600 hover:underline">
                                Contatos ({contatos.length})
                              </summary>
                              <div className="mt-2 w-64 space-y-2">
                                {contatos.slice(0, 3).map((ct) => (
                                  <div key={ct.id} className="rounded bg-slate-50 p-2 text-xs text-slate-600">
                                    <p>{ct.nota}</p>
                                    <p className="mt-1 text-slate-400">
                                      {ct.criado_por ?? "—"} · {new Date(ct.criado_em).toLocaleDateString("pt-BR")}
                                    </p>
                                  </div>
                                ))}
                                <form action={registrarContatoAction} className="flex flex-col gap-1">
                                  <input type="hidden" name="empresa_posto_id" value={empresaSelecionada} />
                                  <input type="hidden" name="empresa_cliente_id" value={c.empresa_cliente_id} />
                                  <textarea
                                    name="nota"
                                    required
                                    rows={2}
                                    placeholder="Ex.: liguei, ofereci 2% de desconto..."
                                    className="input text-xs"
                                  />
                                  <button type="submit" className="btn-secondary self-start text-xs">
                                    Registrar contato
                                  </button>
                                </form>
                              </div>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                    {clientesScore.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Nenhum cliente negociou com este posto ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Score combina os 3 sinais de risco (churn, sensibilidade a preço e fuga de rede) — quanto maior, mais
                urgente contatar. Use &quot;Registrar contato&quot; pra deixar um histórico do que já foi tentado com
                cada cliente.
              </p>
            </>
          )}

          {tab === "churn" && (
            <>
              {erroChurn && <p className="mb-4 text-sm text-red-600">Erro ao carregar clientes: {erroChurn.message}</p>}

              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <IndicadorColorido label="Clientes em dia" valor={String(emDia)} icon={Users} cor="green" />
                <IndicadorColorido label="Clientes em risco" valor={String(emRisco)} icon={AlertTriangle} cor="amber" />
                <IndicadorColorido label="Críticos (2,5x+ atraso)" valor={String(criticos)} icon={TrendingDown} cor="red" />
                <IndicadorColorido label="Nunca abasteceram aqui" valor={String(nuncaAbasteceram)} icon={Ban} cor="violet" />
              </div>

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Cidade/UF</th>
                      <th className="px-4 py-3">Última compra</th>
                      <th className="px-4 py-3">Intervalo médio</th>
                      <th className="px-4 py-3">Atraso</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesChurn.map((c) => (
                      <tr key={c.empresa_cliente_id} className="transition-colors hover:bg-frota-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                        <td className="px-4 py-3 text-slate-600">{c.municipio ? `${c.municipio}/${c.uf ?? ""}` : "—"}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.ultima_compra
                            ? `${new Date(c.ultima_compra).toLocaleDateString("pt-BR")} (${c.dias_desde_ultima_compra}d)`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.intervalo_medio_dias != null ? `${c.intervalo_medio_dias} dias` : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{c.razao_atraso != null ? `${c.razao_atraso}x` : "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              CHURN_STATUS_CLASSE[c.status] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {CHURN_STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/clientes-posto/${c.empresa_cliente_id}?empresa=${empresaSelecionada}`}
                            className="text-frota-600 hover:underline"
                          >
                            Ver cliente
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {clientesChurn.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Nenhum cliente negociou com este posto ainda. Cadastro dos clientes fica em{" "}
                          <Link href="/clientes-posto" className="text-frota-600 hover:underline">
                            Clientes
                          </Link>
                          .
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Status calculado a partir do intervalo médio histórico de cada cliente com este posto — atenção a
                partir de 1,5x o próprio intervalo, crítico a partir de 2,5x.
              </p>
            </>
          )}

          {tab === "preco" && (
            <>
              {erroPreco && <p className="mb-4 text-sm text-red-600">Erro ao carregar dados: {erroPreco.message}</p>}

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Preço médio pago</th>
                      <th className="px-4 py-3">Compras c/ preço baixo</th>
                      <th className="px-4 py-3">Compras c/ preço alto</th>
                      <th className="px-4 py-3">Índice</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesPreco.map((c) => (
                      <tr key={c.empresa_cliente_id} className="transition-colors hover:bg-frota-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.preco_medio_pago != null
                            ? c.preco_medio_pago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{c.qtd_preco_baixo}</td>
                        <td className="px-4 py-3 text-slate-500">{c.qtd_preco_alto}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.indice_sensibilidade != null ? c.indice_sensibilidade.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              PRECO_STATUS_CLASSE[c.status] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {PRECO_STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {clientesPreco.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Nenhum cliente negociou com este posto ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Índice de sensibilidade compara, por cliente, quantas vezes ele comprou com preço abaixo da própria
                média (histórico dele mesmo aqui) contra quantas vezes comprou com preço acima. Quanto mais perto de
                +1, mais ele concentra as compras nos momentos de preço baixo.
              </p>
            </>
          )}

          {tab === "horario" && (
            <>
              {erroHorario && <p className="mb-4 text-sm text-red-600">Erro ao carregar dados: {erroHorario.message}</p>}

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Dia da semana</th>
                      <th className="px-4 py-3">Faixa de horário</th>
                      <th className="px-4 py-3">Abastecimentos</th>
                      <th className="px-4 py-3">Litros médio</th>
                      <th className="px-4 py-3">Ticket médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {horarios.map((h, idx) => (
                      <tr
                        key={`${h.dia_semana}-${h.faixa_horario}`}
                        className={`transition-colors hover:bg-frota-50/60 ${idx < 3 ? "bg-amber-50/50" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{h.dia_semana_label}</td>
                        <td className="px-4 py-3 text-slate-600">{h.faixa_horario}</td>
                        <td className="px-4 py-3 text-slate-500">{h.qtd_abastecimentos}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {h.litros_medio != null ? `${h.litros_medio} L` : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {h.ticket_medio != null
                            ? h.ticket_medio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {horarios.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          Sem abastecimentos suficientes nos últimos 180 dias.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Ordenado por ticket médio (últimos 180 dias) — as 3 linhas destacadas são os melhores momentos pra
                concentrar promoção, reforço de equipe ou estoque de conveniência.
              </p>
            </>
          )}

          {tab === "fuga" && (
            <>
              {erroFuga && <p className="mb-4 text-sm text-red-600">Erro ao carregar dados: {erroFuga.message}</p>}

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Litros aqui (90d)</th>
                      <th className="px-4 py-3">Litros aqui (90-180d)</th>
                      <th className="px-4 py-3">Participação atual</th>
                      <th className="px-4 py-3">Participação anterior</th>
                      <th className="px-4 py-3">Queda</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesFuga.map((c) => (
                      <tr key={c.empresa_cliente_id} className="transition-colors hover:bg-frota-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                        <td className="px-4 py-3 text-slate-600">{c.litros_aqui_periodo_atual.toLocaleString("pt-BR")} L</td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.litros_aqui_periodo_anterior.toLocaleString("pt-BR")} L
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.participacao_atual != null ? `${(c.participacao_atual * 100).toFixed(0)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.participacao_anterior != null ? `${(c.participacao_anterior * 100).toFixed(0)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.queda_participacao_pp != null ? `${c.queda_participacao_pp} p.p.` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              FUGA_STATUS_CLASSE[c.status] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {FUGA_STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {clientesFuga.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Nenhum cliente negociou com este posto ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Compara o volume do cliente NESTE posto com o volume total dele na rede inteira (todos os postos +
                abastecimento interno), em duas janelas de 90 dias. Não mostra onde mais o cliente abastece — só se a
                fatia deste posto na frota dele está caindo.
              </p>
            </>
          )}

          {tab === "pareto" && (
            <>
              {erroPareto && <p className="mb-4 text-sm text-red-600">Erro ao carregar dados: {erroPareto.message}</p>}

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Receita (180d)</th>
                      <th className="px-4 py-3">% da receita</th>
                      <th className="px-4 py-3">% acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesPareto.map((c) => (
                      <tr
                        key={c.empresa_cliente_id}
                        className={`transition-colors hover:bg-frota-50/60 ${Number(c.posicao) <= 3 ? "bg-amber-50/50" : ""}`}
                      >
                        <td className="px-4 py-3 text-slate-500">{c.posicao}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{c.participacao_pct}%</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{c.participacao_acumulada_pct}%</td>
                      </tr>
                    ))}
                    {clientesPareto.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          Nenhum cliente negociou com este posto ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                As 3 primeiras linhas destacadas mostram o quanto os maiores clientes concentram da receita dos
                últimos 180 dias — quanto maior a concentração, mais frágil o caixa fica se um deles sumir.
              </p>
            </>
          )}

          {tab === "mix" && (
            <>
              {erroMix && <p className="mb-4 text-sm text-red-600">Erro ao carregar dados: {erroMix.message}</p>}

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      {produtosUnicos.map((p) => (
                        <th key={p} className="px-4 py-3 text-center">
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...mixPorCliente.entries()].map(([id, info]) => (
                      <tr key={id} className="transition-colors hover:bg-frota-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{info.nome}</td>
                        {produtosUnicos.map((p) => (
                          <td key={p} className="px-4 py-3 text-center">
                            {info.produtos.get(p) ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {mixPorCliente.size === 0 && (
                      <tr>
                        <td colSpan={produtosUnicos.length + 1} className="px-4 py-8 text-center text-slate-400">
                          Cadastre os preços dos produtos que o posto vende em{" "}
                          <Link href="/precos-postos" className="text-frota-600 hover:underline">
                            Preços
                          </Link>{" "}
                          pra ver o cruzamento aqui.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Um &quot;—&quot; num produto que o posto vende é oportunidade de cross-sell: o cliente pode estar
                comprando aquele combustível em outro lugar.
              </p>
            </>
          )}

          {tab === "precoregional" && (
            <>
              {erroPrecoRegional && (
                <p className="mb-4 text-sm text-red-600">Erro ao carregar dados: {erroPrecoRegional.message}</p>
              )}

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Combustível</th>
                      <th className="px-4 py-3">Seu preço</th>
                      <th className="px-4 py-3">Referência ANP</th>
                      <th className="px-4 py-3">Nível</th>
                      <th className="px-4 py-3">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {precoRegional.map((p) => (
                      <tr key={p.combustivel} className="transition-colors hover:bg-frota-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{p.combustivel}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.preco_posto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {p.preco_anp.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{p.nivel_anp}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${p.diff_pct > 0 ? "text-red-600" : "text-green-600"}`}>
                            {p.diff_pct > 0 ? "+" : ""}
                            {p.diff_pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {precoRegional.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          Cadastre os preços em{" "}
                          <Link href="/precos-postos" className="text-frota-600 hover:underline">
                            Preços
                          </Link>{" "}
                          pra ver a comparação com a referência ANP da sua região.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Compara o preço que você mesmo cadastrou com a referência ANP mais específica disponível (município,
                senão estado, senão Brasil) — vermelho é acima da referência, verde é abaixo.
              </p>
            </>
          )}

          {tab === "insights" && (
            <div className="space-y-3">
              {insights.map((insight) => (
                <CardInsightIA key={insight.id} insight={insight} />
              ))}
              {insights.length === 0 && (
                <p className="card p-8 text-center text-sm text-slate-400">
                  Nenhum insight no momento — o job diário revisa a operação todo dia e só mostra aqui o que realmente
                  valer a pena.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
