import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarDataBr, formatarDataHoraBr } from "@/lib/utils";
import { LogoProvedor } from "@/components/LogoProvedor";
import { caminhoAbastecimento, type IdentificadorAbastecimento } from "@/lib/ajustesAbastecimentos";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoMenosDias(diasAtras: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - diasAtras);
  return d.toISOString().slice(0, 10);
}

type Divergencia = {
  id: string;
  provedor: string;
  codigo_abastecimento: string | null;
  data_abastecimento: string;
  empresa_cliente_id: string;
  placa: string | null;
  combustivel: string | null;
  litros: number | null;
  valor_total: number | null;
  preco_praticado: number | null;
  negociacao_id: string | null;
  preco_acordado: number | null;
  diferenca_rs: number | null;
  diferenca_pct: number | null;
  tem_ajuste_pendente: boolean;
};

type ExtratoDia = {
  dia: string;
  provedor: string;
  qtd_abastecimentos: number;
  litros: number;
  valor_total: number;
  qtd_divergencias: number;
  valor_divergencia: number;
};

type SearchParams = { empresa?: string; tab?: string; de?: string; ate?: string };

// Fase Conferência-de-Preços-Posto (09/08/2026, pedido do Daniel):
// "Desenvolver na visao do posto, um mecanismo de conferencia do preço que
// foi praticado no abastecimento, com a regra comercial, acordo ou
// negociação e um extrato diario detalhado dos meios de pagamento, para que
// o usuario do posto consiga visualizar e tomar decisoes em relação a
// ajustes de abastecimentos por nao terem cumprido os acordos com os
// clientes. Alertas e notificacoes dentro do dia são importantes para a
// decisao do posto, para que nao sejam acumulados e vistos somente em
// fechamentos de ciclos com clientes".
//
// Duas abas sobre a mesma base (RPC posto_conferencia_precos, ver migração
// "conferencia_precos_posto"): "Divergências de Preço" (posto_divergencias_preco
// — só o que fugiu da negociação aceita vigente, além da tolerância) e
// "Extrato Diário" (posto_extrato_diario — visão de caixa por dia + meio de
// pagamento, igual ao pedido "extrato diario detalhado dos meios de
// pagamento"). O card "Hoje" abaixo do cabeçalho é sempre calculado pro dia
// de HOJE, independente do período escolhido no filtro — é o "alerta dentro
// do dia" pedido pelo Daniel, pra não esperar o fechamento de ciclo pra
// perceber.
//
// A "regra comercial/acordo" comparada é negociacoes_postos (status='aceita'
// vigente na data do abastecimento) — é o mecanismo de negociação VIVO do
// app (ver achado registrado na migração da RPC: acordos_precos, import
// legado em lote, tem 1 linha só, não é fonte confiável hoje). Resolver um
// ajuste encontrado aqui usa o MESMO fluxo de proposta/aceite já existente
// (ajustes_abastecimentos, ver /abastecimentos/[id] e
// /abastecimentos/externo/[id]) — não duplicamos essa máquina de estados,
// só apontamos pra ela via o link "Ver e solicitar ajuste".
export default async function ConferenciaPrecosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, tab: tabParam, de: deParam, ate: ateParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const tab = tabParam === "extrato" ? "extrato" : "divergencias";
  const hoje = hojeIso();
  const de = deParam || isoMenosDias(6);
  const ate = ateParam || hoje;

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }
  const souPosto = segmentoSelecionado === "Revenda";

  let divergencias: Divergencia[] = [];
  let divergenciasHoje: Divergencia[] = [];
  let extrato: ExtratoDia[] = [];
  let erro: string | undefined;
  let nomesClientes = new Map<string, string>();

  if (empresaSelecionada && souPosto) {
    const [
      { data: divergenciasRaw, error: erroDivergencias },
      { data: hojeRaw, error: erroHoje },
      { data: extratoRaw, error: erroExtrato },
    ] = await Promise.all([
      supabase.rpc("posto_divergencias_preco", {
        p_empresa_posto_id: empresaSelecionada,
        p_data_inicio: de,
        p_data_fim: ate,
      }),
      supabase.rpc("posto_divergencias_preco", {
        p_empresa_posto_id: empresaSelecionada,
        p_data_inicio: hoje,
        p_data_fim: hoje,
      }),
      supabase.rpc("posto_extrato_diario", {
        p_empresa_posto_id: empresaSelecionada,
        p_data_inicio: de,
        p_data_fim: ate,
      }),
    ]);

    if (erroDivergencias) console.error("[conferencia-precos] falha ao buscar divergências:", erroDivergencias);
    if (erroHoje) console.error("[conferencia-precos] falha ao buscar divergências de hoje:", erroHoje);
    if (erroExtrato) console.error("[conferencia-precos] falha ao buscar extrato diário:", erroExtrato);
    if (erroDivergencias || erroExtrato) erro = "Não foi possível carregar todos os dados. Tente novamente em instantes.";

    divergencias = divergenciasRaw ?? [];
    divergenciasHoje = hojeRaw ?? [];
    extrato = extratoRaw ?? [];

    const idsClientes = Array.from(new Set(divergencias.map((d) => d.empresa_cliente_id)));
    if (idsClientes.length > 0) {
      const { data: empresasData } = await supabase.rpc("nomes_empresas_publico", { p_empresa_ids: idsClientes });
      nomesClientes = new Map((empresasData ?? []).map((e) => [e.id, e.nome ?? "—"]));
    }
  }

  const valorDivergenciaHoje = divergenciasHoje.reduce((soma, d) => soma + Math.abs(d.diferenca_rs ?? 0) * (d.litros ?? 0), 0);

  const totalAbastecimentosPeriodo = extrato.reduce((s, e) => s + e.qtd_abastecimentos, 0);
  const totalLitrosPeriodo = extrato.reduce((s, e) => s + e.litros, 0);
  const totalReceitaPeriodo = extrato.reduce((s, e) => s + e.valor_total, 0);
  const totalDivergenciasPeriodo = extrato.reduce((s, e) => s + e.qtd_divergencias, 0);
  const totalValorDivergenciaPeriodo = extrato.reduce((s, e) => s + e.valor_divergencia, 0);

  function linkFiltro(extra: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const base = { empresa: empresaSelecionada ?? undefined, tab, de, ate, ...extra };
    for (const [chave, valor] of Object.entries(base)) {
      if (valor) sp.set(chave, valor);
    }
    const qs = sp.toString();
    return qs ? `/conferencia-precos?${qs}` : "/conferencia-precos";
  }

  function identificadorDaLinha(d: Divergencia): IdentificadorAbastecimento {
    return d.provedor === "profrotas" ? { tipo: "profrotas", id: Number(d.id) } : { tipo: "externo", id: Number(d.id) };
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Conferência de Preços</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compare o preço praticado em cada abastecimento com o acordo/negociação vigente, e acompanhe o extrato diário
          por meio de pagamento{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
        </p>
      </div>

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

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      )}

      {empresaSelecionada && !souPosto && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta tela é exclusiva para postos revendedores.
        </p>
      )}

      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

      {empresaSelecionada && souPosto && (
        <>
          {/* Fase Conferência-de-Preços-Posto — alerta SEMPRE do dia de hoje,
              independente do período escolhido no filtro abaixo: é o pedido
              explícito do Daniel de não deixar acumular pra só ver no
              fechamento de ciclo. */}
          {divergenciasHoje.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              🚨 <strong>{divergenciasHoje.length} abastecimento(s) hoje</strong> fora do preço acordado com o cliente —
              impacto de {formatarMoeda(valorDivergenciaHoje)} até agora. Confira abaixo antes do fechamento do dia.
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Indicador label="Abastecimentos no período" valor={totalAbastecimentosPeriodo.toLocaleString("pt-BR")} />
            <Indicador label="Volume no período" valor={`${totalLitrosPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
            <Indicador label="Receita no período" valor={formatarMoeda(totalReceitaPeriodo)} />
            <Indicador
              label="Divergências no período"
              valor={String(totalDivergenciasPeriodo)}
              destaque={totalDivergenciasPeriodo > 0}
            />
            <Indicador
              label="Impacto das divergências"
              valor={formatarMoeda(totalValorDivergenciaPeriodo)}
              destaque={totalValorDivergenciaPeriodo !== 0}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Link
                href={linkFiltro({ tab: "divergencias" })}
                className={`rounded-full px-3 py-1 text-xs font-medium ${tab === "divergencias" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                Divergências de Preço
              </Link>
              <Link
                href={linkFiltro({ tab: "extrato" })}
                className={`rounded-full px-3 py-1 text-xs font-medium ${tab === "extrato" ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                Extrato Diário
              </Link>
            </div>
            <form className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="empresa" value={empresaSelecionada} />
              <input type="hidden" name="tab" value={tab} />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">De</label>
                <input type="date" name="de" defaultValue={de} className="input text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Até</label>
                <input type="date" name="ate" defaultValue={ate} className="input text-sm" />
              </div>
              <button type="submit" className="btn-secondary text-sm">
                Filtrar
              </button>
            </form>
          </div>

          {tab === "divergencias" ? (
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Placa</th>
                    <th className="px-4 py-3">Combustível</th>
                    <th className="px-4 py-3">Meio de pagamento</th>
                    <th className="px-4 py-3">Praticado</th>
                    <th className="px-4 py-3">Acordado</th>
                    <th className="px-4 py-3">Diferença</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {divergencias.map((d) => {
                    const acimaDoAcordo = (d.diferenca_rs ?? 0) > 0;
                    return (
                      <tr key={`${d.provedor}-${d.id}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{formatarDataHoraBr(d.data_abastecimento)}</td>
                        <td className="px-4 py-3 text-slate-700">{nomesClientes.get(d.empresa_cliente_id) ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{d.placa ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{d.combustivel ?? "—"}</td>
                        <td className="px-4 py-3">
                          <LogoProvedor provedor={d.provedor} className="h-5 w-auto" />
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-700">
                          {d.preco_praticado != null ? formatarMoeda(d.preco_praticado) : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-500">
                          {d.preco_acordado != null ? formatarMoeda(d.preco_acordado) : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          <span className={`font-medium ${acimaDoAcordo ? "text-red-600" : "text-amber-600"}`}>
                            {acimaDoAcordo ? "+" : ""}
                            {formatarMoeda(d.diferenca_rs ?? 0)} ({d.diferenca_pct != null ? `${d.diferenca_pct > 0 ? "+" : ""}${d.diferenca_pct}%` : "—"})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {d.tem_ajuste_pendente ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Ajuste em andamento
                            </span>
                          ) : (
                            <Link href={caminhoAbastecimento(identificadorDaLinha(d))} className="text-frota-600 hover:underline">
                              Ver e solicitar ajuste
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {divergencias.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Nenhuma divergência de preço encontrada neste período — tudo dentro do acordado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Dia</th>
                    <th className="px-4 py-3">Meio de pagamento</th>
                    <th className="px-4 py-3">Abastecimentos</th>
                    <th className="px-4 py-3">Litros</th>
                    <th className="px-4 py-3">Valor total</th>
                    <th className="px-4 py-3">Divergências</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {extrato.map((e) => (
                    <tr key={`${e.dia}-${e.provedor}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{formatarDataBr(e.dia)}</td>
                      <td className="px-4 py-3">
                        <LogoProvedor provedor={e.provedor} className="h-5 w-auto" />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{e.qtd_abastecimentos}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {e.litros.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{formatarMoeda(e.valor_total)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {e.qtd_divergencias > 0 ? (
                          <span className="text-red-600">
                            {e.qtd_divergencias} · {formatarMoeda(e.valor_divergencia)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {extrato.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Nenhum abastecimento fornecido neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Indicador({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`card p-4 ${destaque ? "border-red-200 bg-red-50/50" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${destaque ? "text-red-700" : "text-slate-900"}`}>{valor}</p>
    </div>
  );
}
