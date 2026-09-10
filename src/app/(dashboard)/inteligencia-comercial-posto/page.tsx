import Link from "next/link";
import { Users, AlertTriangle, TrendingDown, Ban } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";

type SearchParams = { empresa?: string; tab?: string };

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

// Fase Inteligência-Comercial-Posto (09/09/2026, pedido do Daniel: "desenhar a
// tela de devolutiva para o posto" a partir da discussão sobre o programa de
// fidelidade como ferramenta de inteligência comercial, não só promoção).
// Devolve pro posto, em cima do próprio histórico de abastecimento, o mesmo
// tipo de sinal que hoje só existe do lado da frota (Ações Sugeridas,
// Insights de IA). Primeira leva: só "clientes em risco de churn"
// (RPC clientes_em_risco_churn).
//
// Fase Inteligência-Comercial-Posto-2 (09/09/2026, pedido do Daniel: "vamos
// continuar com as melhorias" — as 4 perguntas de negócio da discussão
// original) — 3 abas novas, mesmo padrão de navegação por ?tab= já usado em
// /conferencia-precos:
//  - "Sensibilidade a Preço" (RPC sensibilidade_preco_clientes_posto): compara,
//    por cliente, a frequência de compra quando o preço pago esteve acima ou
//    abaixo da própria média — sem depender de nenhuma tabela de preço
//    histórica nova, só do preco_litro já registrado em cada abastecimento.
//  - "Horário de Pico" (RPC padrao_horario_abastecimento_posto): ticket médio
//    e volume por dia da semana e faixa de horário, últimos 180 dias.
//  - "Fuga de Rede" (RPC fuga_de_rede_clientes_posto): compara o volume do
//    cliente NESTE posto com o volume total dele na rede toda (todos os
//    postos + abastecimento interno) em duas janelas de 90 dias — SECURITY
//    DEFINER cross-tenant por natureza (mesmo motivo de historico_precos: só
//    assim dá pra medir a fatia real deste posto na frota do cliente), mas
//    NUNCA expõe onde mais o cliente abastece — só o percentual e a queda.
export default async function InteligenciaComercialPostoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, tab: tabParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const tab = ["churn", "preco", "horario", "fuga"].includes(tabParam ?? "") ? (tabParam as string) : "churn";

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
            <Link
              href={linkAba("churn")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${tab === "churn" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Clientes em Risco
            </Link>
            <Link
              href={linkAba("preco")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${tab === "preco" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Sensibilidade a Preço
            </Link>
            <Link
              href={linkAba("horario")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${tab === "horario" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Horário de Pico
            </Link>
            <Link
              href={linkAba("fuga")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${tab === "fuga" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Fuga de Rede
            </Link>
          </div>

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
        </>
      )}
    </div>
  );
}
