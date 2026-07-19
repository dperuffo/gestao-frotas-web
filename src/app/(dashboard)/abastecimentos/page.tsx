import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { AbastecimentosPosto } from "./_components/AbastecimentosPosto";
import { LogoProvedor } from "@/components/LogoProvedor";

const POR_PAGINA = 30;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase 27.133/27.135 — pedido do Daniel: trazer a informação da origem/meio
// de pagamento (Pró-Frotas, Valecard, RedeFrota, TicketLog, Veloe...) nos
// registros de abastecimentos. Cada provedor tem uma cor fixa só pra
// facilitar a leitura visual — não tem significado além disso. Provedor
// desconhecido cai no cinza padrão.
//
// Fase 27.135 — achado real (Daniel, depois de ver a Fase 27.133 no ar):
// "nao deveria ter separacao de meios de pagamento do Pro-Frotas, pois todas
// sao meios de pagamento". A versão anterior tratava PróFrotas como
// especial — tabela principal só com ele + uma seção separada "Outros meios
// de pagamento". Agora é UMA lista só, vinda da view abastecimentos_unificado
// (que passou a expor `id` e `codigo_abastecimento` nesta fase, pra dar pra
// manter o link de detalhe/ajuste nas linhas PróFrotas dentro dessa mesma
// lista — as demais linhas não têm essa página de detalhe, então aparecem
// sem link, mas lado a lado com as demais, sem seção à parte).
const CORES_PROVEDOR: Record<string, string> = {
  profrotas: "bg-blue-100 text-blue-700",
  Valecard: "bg-purple-100 text-purple-700",
  RedeFrota: "bg-orange-100 text-orange-700",
  TicketLog: "bg-teal-100 text-teal-700",
  Veloe: "bg-pink-100 text-pink-700",
};

function nomeProvedor(provedor: string) {
  return provedor === "profrotas" ? "PróFrotas" : provedor;
}

function BadgeProvedor({ provedor }: { provedor: string }) {
  const classe = CORES_PROVEDOR[provedor] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classe}`}>
      {nomeProvedor(provedor)}
    </span>
  );
}

// Fase 27.135 — uma linha só, venha ela de profrotas_abastecimentos ou de
// abastecimentos_externos (view abastecimentos_unificado). `id` é sempre
// texto (as duas fontes usam bigint de sequências diferentes — unificar
// como texto evita colidir "id 31 do PróFrotas" com "id 31 da Valecard").
// Fase 27.152 — `codigo_abastecimento` agora existe dos dois lados: código
// de 10 dígitos começando com "1" pra PróFrotas (Fase 27.104) e com "2" pra
// abastecimentos integrados via API/planilha (TicketLog, RedeFrota,
// Valecard, Veloe) — faixas próprias, nunca colidem entre si.
type RegistroUnificado = {
  id: string;
  provedor: string;
  codigo_abastecimento: string | null;
  data_abastecimento: string | null;
  placa: string | null;
  motorista_nome: string | null;
  produto: string | null;
  litros: number | null;
  valor_total: number | null;
  posto_nome: string | null;
};

export default async function AbastecimentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    de?: string;
    ate?: string;
    empresa?: string;
    page?: string;
    combustivel?: string;
    cliente?: string;
    ajuste?: string;
    nf?: string;
    provedor?: string;
  }>;
}) {
  const { q, de, ate, empresa: empresaParam, page: pageParam, combustivel, cliente, ajuste, nf, provedor } =
    await searchParams;
  const supabase = await createClient();

  // Fase 27.8 — mesmo seletor de cliente já usado em Postos, Relatórios,
  // Veículos e Motoristas, agora também em Abastecimentos.
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  // Fase 27.58 — achado real: o posto pediu pra ver, na mesma tela, os
  // abastecimentos que FORNECEU (não os que consumiu — essa página inteira
  // abaixo é do ponto de vista do cliente de frota). Resolve o segmento da
  // empresa selecionada (mesmo padrão de /negociacoes, /precos-postos,
  // /dashboard) e desvia pro painel do posto antes de rodar as consultas
  // de Frota.
  if (empresaSelecionada) {
    const { data: empresaAtual } = await supabase
      .from("empresas")
      .select("segmento")
      .eq("id", empresaSelecionada)
      .maybeSingle();
    if (empresaAtual?.segmento === "Revenda") {
      return (
        <AbastecimentosPosto
          empresaPostoId={empresaSelecionada}
          nomeEmpresaSelecionada={nomeEmpresaSelecionada}
          searchParams={{ combustivel, cliente, q, de, ate, page: pageParam, ajuste, nf, provedor }}
        />
      );
    }
  }

  // Fase 27.68 — Daniel pediu um filtro pra ver só os abastecimentos com
  // ajuste pendente. Busca upfront os IDs (escopados à empresa selecionada —
  // a RLS já limita ao que envolve essa empresa) e reaproveita pra também
  // pintar a bolinha vermelha na linha (Fase 27.67), sem precisar de uma 2ª
  // consulta separada.
  //
  // Fase 27.142 — ajuste deixou de ser só do lado PróFrotas (agora também
  // existe pra abastecimentos_externos, com o id na coluna
  // abastecimento_externo_id) — precisa de 2 conjuntos separados, porque o
  // `id` da view abastecimentos_unificado só é único DENTRO de cada
  // provedor (bigint de sequências independentes por tabela-fonte): um id
  // profrotas e um id externo podem coincidir por acaso.
  let idsComAjusteAbertoProfrotas = new Set<number>();
  let idsComAjusteAbertoExterno = new Set<number>();
  if (empresaSelecionada) {
    const { data: ajustesAbertosTodos } = await supabase
      .from("ajustes_abastecimentos")
      .select("abastecimento_id, abastecimento_externo_id")
      .eq("empresa_cliente_id", empresaSelecionada)
      .in("status", ["pendente_cliente", "pendente_posto"]);
    for (const a of ajustesAbertosTodos ?? []) {
      if (a.abastecimento_id != null) idsComAjusteAbertoProfrotas.add(a.abastecimento_id);
      if (a.abastecimento_externo_id != null) idsComAjusteAbertoExterno.add(a.abastecimento_externo_id);
    }
  }
  const idsFiltroProfrotas =
    idsComAjusteAbertoProfrotas.size > 0 ? Array.from(idsComAjusteAbertoProfrotas).map((id) => String(id)) : ["-1"];
  const idsFiltroExterno =
    idsComAjusteAbertoExterno.size > 0 ? Array.from(idsComAjusteAbertoExterno).map((id) => String(id)) : ["-1"];

  // Builder genérico do supabase-js — usado pras 3 consultas (contagem,
  // agregados e página) com os mesmos filtros, por isso não dá pra tipar
  // exatamente igual ao retorno específico de cada .select() diferente.
  // Fonte: view abastecimentos_unificado (Fase 27.133/27.135) — já filtra
  // só linhas confirmadas/não estornadas do lado PróFrotas, e não separa
  // por provedor (todos os meios de pagamento numa lista só).
  function comFiltros(builder: any) {
    let query = builder;
    // Fase 27.104 — pedido do Daniel: buscar pelo ID abastecimento (código
    // de 10 dígitos, só existe pro lado PróFrotas) também no filtro livre.
    if (q)
      query = query.or(
        `placa.ilike.%${q}%,motorista_nome.ilike.%${q}%,posto_nome.ilike.%${q}%,codigo_abastecimento.ilike.%${q}%`
      );
    if (de) query = query.gte("data_abastecimento", de);
    if (ate) query = query.lte("data_abastecimento", `${ate}T23:59:59`);
    if (empresaSelecionada) query = query.eq("empresa_id", empresaSelecionada);
    // Fase 27.147 — pedido do Daniel: filtro por meio de pagamento
    // (provedor), igual ao filtro de combustível já existente.
    if (provedor) query = query.eq("provedor", provedor);
    // Fase 27.142 — casa tanto ajuste pendente do lado PróFrotas quanto do
    // lado externo, sem deixar um id de um provedor "colidir" por
    // coincidência com o id de ajuste do outro (ver comentário acima).
    if (ajuste === "pendente")
      query = query.or(
        `and(provedor.eq.profrotas,id.in.(${idsFiltroProfrotas.join(",")})),and(provedor.neq.profrotas,id.in.(${idsFiltroExterno.join(",")}))`
      );
    return query;
  }

  const offset = offsetDaPagina(POR_PAGINA, pageParam);

  const queryContagem = comFiltros(
    supabase.from("abastecimentos_unificado").select("id", { count: "exact", head: true })
  );
  const queryPagina = comFiltros(
    supabase
      .from("abastecimentos_unificado")
      .select("id, provedor, codigo_abastecimento, data_abastecimento, placa, motorista_nome, produto, litros, valor_total, posto_nome")
  )
    .order("data_abastecimento", { ascending: false })
    .range(offset, offset + POR_PAGINA - 1);

  // Fase FLT-3 — achado real (Daniel, cliente de teste com 8,4k+
  // abastecimentos): "Litros abastecidos"/"Valor total" vinham de
  // .select("litros, valor_total").limit(50000) e soma em JS. O PostgREST
  // corta em 1.000 linhas por padrão quando não há paginação/range explícito
  // (mesmo bug já documentado e corrigido na Inteligência de Rede, Fase 6) —
  // clientes com mais de 1.000 registros tinham esses indicadores calculados
  // sobre uma fatia arbitrária dos dados, quase sempre dominada pelo
  // provedor histórico maior (profrotas). Trocado por uma RPC que soma
  // direto no Postgres (imune ao limite de linhas), replicando os mesmos
  // filtros desta tela (busca, data, provedor, ajuste pendente).
  const queryTotais = empresaSelecionada
    ? supabase.rpc("abastecimentos_totais_filtrados", {
        p_empresa_id: empresaSelecionada,
        p_q: q || null,
        p_de: de || null,
        p_ate: ate || null,
        p_provedor: provedor || null,
        p_apenas_ajuste_pendente: ajuste === "pendente",
      })
    : Promise.resolve({ data: null as { litros: number; valor_total: number; registros: number }[] | null });

  const [{ count }, { data: totaisRaw }, { data: registros, error }] = semClienteEscolhido
    ? [{ count: 0 }, { data: null }, { data: [], error: null }]
    : await Promise.all([queryContagem, queryTotais, queryPagina]);

  const totalRegistros = count ?? 0;
  const linhas = (registros ?? []) as RegistroUnificado[];
  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, POR_PAGINA, pageParam);

  const totaisLinha = (totaisRaw?.[0] ?? null) as { litros: number | null; valor_total: number | null } | null;
  const litrosTotais = Number(totaisLinha?.litros ?? 0);
  const valorTotal = Number(totaisLinha?.valor_total ?? 0);
  const custoMedioLitro = litrosTotais > 0 ? valorTotal / litrosTotais : 0;

  // Consolidado por meio de pagamento (todos os provedores, últimos 6 meses,
  // ignorando os filtros de data da tela — mesmo espírito do "Top 5 clientes"
  // do Dashboard: um resumo estável, não a fatia filtrada no momento).
  // Fase FLT-3 — trocado de .select().limit(50000) + soma em JS (mesmo
  // problema do limite de 1.000 linhas do PostgREST) pela RPC
  // indicadores_financeiros_por_provedor, já usada em /financeiro — agrega
  // no banco, então não perde nenhum provedor por causa do corte de linhas.
  const hojeIso = new Date().toISOString().slice(0, 10);
  const seisMesesAtrasIso = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: resumoRaw } = empresaSelecionada
    ? await supabase.rpc("indicadores_financeiros_por_provedor", {
        p_empresa_id: empresaSelecionada,
        p_data_inicio: seisMesesAtrasIso,
        p_data_fim: hojeIso,
      })
    : { data: [] };
  const listaResumoProvedores = ((resumoRaw ?? []) as { provedor: string; custo_combustivel: number }[])
    .map((r) => [r.provedor, Number(r.custo_combustivel)] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  // Fase 27.147 — pedido do Daniel: filtro por meio de pagamento na lista de
  // abastecimentos, igual ao filtro de combustível. Opções vêm de todo o
  // histórico do cliente (mesma RPC agregada, sem limite de data), não só
  // os últimos 6 meses do resumo acima.
  const { data: provedoresRaw } = empresaSelecionada
    ? await supabase.rpc("indicadores_financeiros_por_provedor", {
        p_empresa_id: empresaSelecionada,
        p_data_inicio: "2000-01-01",
        p_data_fim: hojeIso,
      })
    : { data: [] };
  const provedoresOpcoes = Array.from(
    new Set((provedoresRaw ?? []).map((r: { provedor: string | null }) => r.provedor).filter((p): p is string => !!p))
  ).sort((a, b) => nomeProvedor(a).localeCompare(nomeProvedor(b)));

  // Fase 27.147 — mesma lógica de link já usada no filtro de ajuste
  // pendente abaixo, generalizada pra reaproveitar no filtro de provedor.
  function linkFiltro(extra: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const base = { empresa: empresaParam, q, de, ate, ajuste, provedor, ...extra };
    for (const [chave, valor] of Object.entries(base)) if (valor) sp.set(chave, valor);
    const qs = sp.toString();
    return qs ? `/abastecimentos?${qs}` : "/abastecimentos";
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Abastecimentos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Alimentado automaticamente pelas integrações com meios de pagamento (PróFrotas e outros
            provedores conectados via Hub de Integrações). Lançamento manual e importação em lote
            também disponíveis para clientes sem integração
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/abastecimentos/importar" className="btn-secondary">
            Importar planilha
          </Link>
          <Link href="/abastecimentos/novo" className="btn-primary">
            + Lançar Manualmente
          </Link>
        </div>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
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
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {semClienteEscolhido && (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver os abastecimentos dele.</p>
      )}

      {!semClienteEscolhido && (
      <>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Registros" valor={String(totalRegistros)} />
        <Indicador label="Litros abastecidos" valor={litrosTotais.toLocaleString("pt-BR")} />
        <Indicador label="Valor total" valor={formatarMoeda(valorTotal)} />
        <Indicador label="Custo médio por litro" valor={formatarMoeda(custoMedioLitro)} />
      </div>

      {listaResumoProvedores.length > 0 && (
        <div className="mb-6 card p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Meios de pagamento — últimos 6 meses
          </p>
          <div className="flex flex-wrap gap-2">
            {listaResumoProvedores.map(([provedor, valor]) => (
              <span key={provedor} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <LogoProvedor provedor={provedor} className="h-4 w-auto" /> {formatarMoeda(valor)}
              </span>
            ))}
          </div>
        </div>
      )}

      <form className="mb-4 flex flex-wrap gap-3">
        {/* Fase 27.31 — achado real: este form é SEPARADO do form do seletor
            de Cliente acima. Sem o cliente embutido aqui, submeter esta busca
            derrubava o parâmetro ?empresa= da URL (cada <form> só envia os
            próprios campos ao submeter, mesmo estando na mesma página) —
            fazendo a tela voltar a pedir a seleção do cliente logo depois de
            clicar em "Filtrar". Mesmo bug corrigido em /veiculos e
            /motoristas. */}
        <input type="hidden" name="empresa" value={empresaParam ?? ""} />
        <input type="hidden" name="ajuste" value={ajuste ?? ""} />
        <input type="hidden" name="provedor" value={provedor ?? ""} />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por ID, placa, motorista ou posto..."
          className="input max-w-sm"
        />
        <input type="date" name="de" defaultValue={de ?? ""} className="input" title="Data inicial" />
        <input type="date" name="ate" defaultValue={ate ?? ""} className="input" title="Data final" />
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      {/* Fase 27.147 — pedido do Daniel: filtro por meio de pagamento ao
          lado dos demais, mesmo padrão visual do filtro de combustível já
          usado na visão do posto.
          Fase Provedores-Logos — pedido do Daniel: "os icones na frente das
          logos também não precisa, somente a logo" — cada opção agora é só
          a logo do provedor (LogoProvedor já cai pro texto sozinho se um
          provedor novo ainda não tiver logo cadastrada), com um contorno
          pra marcar qual está selecionada. "Todos" continua texto — não é
          um provedor específico, não tem logo própria. */}
      {provedoresOpcoes.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-500">Meio de pagamento:</span>
          <Link
            href={linkFiltro({ provedor: undefined })}
            className={`rounded-full px-3 py-1 font-medium ${!provedor ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Todos
          </Link>
          {provedoresOpcoes.map((p) => (
            <Link
              key={p}
              href={linkFiltro({ provedor: p })}
              title={nomeProvedor(p)}
              className={`flex items-center rounded-lg border-2 px-2 py-1 ${
                provedor === p ? "border-frota-600 bg-white" : "border-transparent bg-slate-100 opacity-60 hover:opacity-100"
              }`}
            >
              <LogoProvedor provedor={p} className="h-4 w-auto" />
            </Link>
          ))}
        </div>
      )}

      {/* Fase 27.68 — filtro pra ver só quem tem ajuste pendente, pra não
          precisar abrir registro por registro procurando a bolinha vermelha.
          Só afeta linhas PróFrotas (ver comentário em idsFiltroAjuste). */}
      <div className="mb-4">
        <Link
          href={linkFiltro({ ajuste: ajuste === "pendente" ? undefined : "pendente" })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${ajuste === "pendente" ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          🔴 Pendente de ajuste
        </Link>
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar abastecimentos: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Litros</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Posto</th>
              <th className="px-4 py-3">Meio de pagamento</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((r) => {
              const ehProfrotas = r.provedor === "profrotas";
              const temAjustePendente = ehProfrotas
                ? idsComAjusteAbertoProfrotas.has(Number(r.id))
                : idsComAjusteAbertoExterno.has(Number(r.id));
              const dataCelula = (
                <>
                  {temAjustePendente && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title="Ajuste pendente neste abastecimento" />
                  )}
                  {r.data_abastecimento ? formatDate(r.data_abastecimento) : "—"}
                </>
              );
              return (
                <tr key={`${r.provedor}-${r.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                    {r.codigo_abastecimento ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {/* Fase 27.142 — linhas de outros provedores agora também
                        têm página de detalhe/ajuste (antes só PróFrotas
                        tinha; ver /abastecimentos/externo/[id]). `r.id` já é
                        o id real da tabela abastecimentos_externos (a view
                        abastecimentos_unificado não gera um id sintético). */}
                    <Link
                      href={ehProfrotas ? `/abastecimentos/${r.id}` : `/abastecimentos/externo/${r.id}`}
                      className="inline-flex items-center gap-1.5 font-medium text-frota-600 hover:underline"
                    >
                      {dataCelula}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.placa ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.motorista_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.produto ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.litros ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.valor_total != null ? formatarMoeda(r.valor_total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.posto_nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <BadgeProvedor provedor={r.provedor} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-ativo">Confirmado</span>
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  Nenhum abastecimento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4">
          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            porPagina={POR_PAGINA}
            basePath="/abastecimentos"
            paramsAtuais={{ q, de, ate, empresa: empresaParam, ajuste, provedor }}
          />
        </div>
      </div>
      </>
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
