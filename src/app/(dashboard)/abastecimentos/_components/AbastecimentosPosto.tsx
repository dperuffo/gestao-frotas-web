import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PRODUTOS_POSTO } from "@/lib/constants";
import { mensagemMotivoPendencia } from "@/lib/nfe";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";

const POR_PAGINA = 30;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fase 27.102 — pedido do Daniel: "Gostaria que fosse assim na visao do
// posto tambem, identificando no filtro a quantidade de rejeitados e nos
// registros de abastecimentos, o status de rejeitado com a descricao" —
// referindo-se ao filtro/badge de NF-e já existente em /notas-fiscais (Fase
// 27.99/27.100), que faltava aqui em "Abastecimentos Fornecidos" — a tela
// que o posto realmente usa no dia a dia (a outra é uma tela separada, só de
// NF-e). "Acho qu fica mais intuitivo para o usuario de posto para corrigir
// a NF": em vez de o posto precisar ir em /notas-fiscais pra descobrir o que
// foi rejeitado, ele já vê aqui, na mesma lista de abastecimentos que já usa.
const STATUS_NF_VALIDOS = new Set(["emitida", "rejeitada", "pendente"]);

type SearchParamsPosto = {
  combustivel?: string;
  cliente?: string;
  q?: string;
  de?: string;
  ate?: string;
  page?: string;
  ajuste?: string;
  nf?: string;
};

// Fase 27.58 — visão do posto na mesma tela /abastecimentos: o que ele
// FORNECEU (não o que consumiu — isso é o lado cliente, acima em
// AbastecimentosPage). O robô grava pv_cnpj com o CNPJ do posto (ver
// gerar_abastecimentos_postos_robo em Supabase); a RLS
// profrotas_abastecimentos_leitura_posto libera a leitura pra quem for
// dono desse CNPJ. Sem seletor de EMPRESA aqui — o posto já é sempre uma
// única empresa (não tem grupo econômico como Frota) — mas o posto atende
// VÁRIOS clientes, daí o filtro de "cliente" abaixo (Fase 27.65).
//
// Fase 27.65 — Daniel pediu filtro de cliente, data inicial, data final e
// campo livre pra pesquisa, mesmo padrão já usado em /abastecimentos (lado
// Frota, Fase 27.8/27.31) — aqui não existia nenhum desses (só a pill de
// combustível). Aproveitado pra também paginar (Fase 27.12 já tinha corrigido
// isso pro lado Frota; esta tela ficou de fora até agora, com `.limit(500)`
// sem paginação nenhuma).
export async function AbastecimentosPosto({
  empresaPostoId,
  nomeEmpresaSelecionada,
  searchParams,
}: {
  empresaPostoId: string;
  nomeEmpresaSelecionada?: string;
  searchParams: SearchParamsPosto;
}) {
  const supabase = await createClient();
  const { combustivel, cliente, q, de, ate, page, ajuste, nf: nfParam } = searchParams;
  const nf = nfParam && STATUS_NF_VALIDOS.has(nfParam) ? nfParam : null;

  const { data: empresa } = await supabase.from("empresas").select("cnpj").eq("id", empresaPostoId).maybeSingle();
  const meuCnpj = empresa?.cnpj;

  type Registro = {
    id: number;
    data_abastecimento: string | null;
    frota_razao_social: string | null;
    cnpj_frota: string | null;
    veiculo_placa: string | null;
    motorista_nome: string | null;
    item_nome: string | null;
    item_quantidade: number | null;
    item_valor_unitario: number | null;
    item_valor_total: number | null;
  };

  let registros: Registro[] = [];
  let erro: string | undefined;
  let clientesOpcoes: { cnpj: string; nome: string }[] = [];
  let totalRegistros = 0;
  let volumeTotal = 0;
  let receitaTotal = 0;
  let idsComAjusteAberto = new Set<number>();
  let notaPorAbastecimento = new Map<number, number | null>();
  let pendenciaPorAbastecimento = new Map<number, { motivo: string; detalheTexto: string | null }>();
  let contagemNf = { todos: 0, emitida: 0, rejeitada: 0, pendente: 0 };

  const offset = offsetDaPagina(POR_PAGINA, page);

  if (meuCnpj) {
    // Clientes que já abasteceram neste posto — pro seletor de filtro (só
    // quem realmente tem registro aqui, não a lista genérica de negociações).
    const { data: clientesData } = await supabase
      .from("profrotas_abastecimentos")
      .select("cnpj_frota, frota_razao_social")
      .eq("pv_cnpj", meuCnpj)
      .limit(5000);
    const mapaClientes = new Map<string, string>();
    for (const c of clientesData ?? []) {
      if (c.cnpj_frota && !mapaClientes.has(c.cnpj_frota)) {
        mapaClientes.set(c.cnpj_frota, c.frota_razao_social ?? c.cnpj_frota);
      }
    }
    clientesOpcoes = Array.from(mapaClientes, ([cnpj, nome]) => ({ cnpj, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );

    // Fase 27.68 — Daniel pediu um filtro pra ver só os abastecimentos com
    // ajuste pendente ("melhor visualização"). Aproveitada a mesma consulta
    // pra também pintar a bolinha vermelha na linha (Fase 27.67) — antes essa
    // bolinha só olhava a página atual; agora é 1 consulta só, com todos os
    // IDs em aberto pra este posto (a RLS já limita ao que envolve este
    // posto), reaproveitada nos dois lugares.
    const { data: ajustesAbertosTodos } = await supabase
      .from("ajustes_abastecimentos")
      .select("abastecimento_id")
      .in("status", ["pendente_cliente", "pendente_posto"]);
    idsComAjusteAberto = new Set((ajustesAbertosTodos ?? []).map((a) => a.abastecimento_id));
    const idsFiltroAjuste = idsComAjusteAberto.size > 0 ? Array.from(idsComAjusteAberto) : [-1];

    // Fase 27.102 — mesma ideia da bolinha de ajuste acima: 2 consultas com
    // TODOS os registros de NF-e/pendência deste posto (tabelas já têm RLS
    // própria escopando por empresa_posto_id — Fases 27.94/27.99), viradas em
    // mapa abastecimento_id -> status, reaproveitadas tanto pra pintar o
    // badge de cada linha quanto pra montar os filtros por status abaixo.
    // Pendência só "vale" se ainda não tem NF-e emitida pro mesmo
    // abastecimento (mesma regra da LEFT JOIN LATERAL "on nf.id is null" já
    // usada em abastecimentos_com_status_nota_fiscal) — assim que o posto
    // reenvia a NF-e certa, a rejeição antiga some sozinha da lista.
    const [{ data: notasData }, { data: pendenciasData }] = await Promise.all([
      supabase
        .from("notas_fiscais_abastecimento")
        .select("abastecimento_id, numero_nf")
        .eq("empresa_posto_id", empresaPostoId)
        .limit(20000),
      supabase
        .from("notas_fiscais_pendencias")
        .select("abastecimento_id, motivo, detalhe_texto, criado_em")
        .eq("empresa_posto_id", empresaPostoId)
        .not("abastecimento_id", "is", null)
        .order("criado_em", { ascending: false })
        .limit(20000),
    ]);

    notaPorAbastecimento = new Map((notasData ?? []).map((n) => [n.abastecimento_id, n.numero_nf]));
    pendenciaPorAbastecimento = new Map();
    for (const p of pendenciasData ?? []) {
      if (p.abastecimento_id === null || pendenciaPorAbastecimento.has(p.abastecimento_id)) continue;
      pendenciaPorAbastecimento.set(p.abastecimento_id, { motivo: p.motivo, detalheTexto: p.detalhe_texto });
    }

    const idsEmitida = Array.from(notaPorAbastecimento.keys());
    const idsRejeitada = Array.from(pendenciaPorAbastecimento.keys()).filter((id) => !notaPorAbastecimento.has(id));
    const idsSemTentativa = [...idsEmitida, ...idsRejeitada];

    function aplicarFiltrosBase<
      T extends {
        eq: (...args: [string, string]) => T;
        or: (arg: string) => T;
        gte: (...args: [string, string]) => T;
        lte: (...args: [string, string]) => T;
        in: (coluna: string, valores: number[]) => T;
      },
    >(builder: T): T {
      let query = builder.eq("pv_cnpj", meuCnpj as string);
      if (combustivel && (PRODUTOS_POSTO as readonly string[]).includes(combustivel)) {
        query = query.eq("item_nome", combustivel);
      }
      if (cliente) query = query.eq("cnpj_frota", cliente);
      if (q) query = query.or(`veiculo_placa.ilike.%${q}%,motorista_nome.ilike.%${q}%,frota_razao_social.ilike.%${q}%`);
      if (de) query = query.gte("data_abastecimento", de);
      if (ate) query = query.lte("data_abastecimento", `${ate}T23:59:59`);
      if (ajuste === "pendente") query = query.in("id", idsFiltroAjuste);
      return query;
    }

    // Fase 27.102 — aplica o filtro de status de NF-e por cima dos filtros
    // já existentes (combustível/cliente/busca/data/ajuste), reaproveitando
    // os mesmos "ids extras" já usados pro filtro de ajuste pendente.
    function aplicarFiltrosComNf<
      T extends {
        eq: (...args: [string, string]) => T;
        or: (arg: string) => T;
        gte: (...args: [string, string]) => T;
        lte: (...args: [string, string]) => T;
        in: (coluna: string, valores: number[]) => T;
        not: (coluna: string, operador: string, valor: string) => T;
      },
    >(builder: T): T {
      let query = aplicarFiltrosBase(builder);
      if (nf === "emitida") query = query.in("id", idsEmitida.length > 0 ? idsEmitida : [-1]);
      else if (nf === "rejeitada") query = query.in("id", idsRejeitada.length > 0 ? idsRejeitada : [-1]);
      else if (nf === "pendente" && idsSemTentativa.length > 0) query = query.not("id", "in", `(${idsSemTentativa.join(",")})`);
      return query;
    }

    const [
      { count },
      { data: agregadosRaw },
      resultadoPagina,
      { count: countTodos },
      { count: countEmitida },
      { count: countRejeitada },
      { count: countPendente },
    ] = await Promise.all([
      aplicarFiltrosComNf(supabase.from("profrotas_abastecimentos").select("id", { count: "exact", head: true })),
      aplicarFiltrosComNf(supabase.from("profrotas_abastecimentos").select("item_quantidade, item_valor_total")).limit(50000),
      aplicarFiltrosComNf(
        supabase
          .from("profrotas_abastecimentos")
          .select(
            "id, data_abastecimento, frota_razao_social, cnpj_frota, veiculo_placa, motorista_nome, item_nome, item_quantidade, item_valor_unitario, item_valor_total"
          )
      )
        .order("data_abastecimento", { ascending: false })
        .range(offset, offset + POR_PAGINA - 1),
      // Fase 27.102 — contagens dos filtros de status SEMPRE com os filtros
      // base (sem o próprio filtro de nf), pra os números não sumirem/mudarem
      // quando o posto clica de um filtro de status pro outro.
      aplicarFiltrosBase(supabase.from("profrotas_abastecimentos").select("id", { count: "exact", head: true })),
      aplicarFiltrosBase(supabase.from("profrotas_abastecimentos").select("id", { count: "exact", head: true })).in(
        "id",
        idsEmitida.length > 0 ? idsEmitida : [-1]
      ),
      aplicarFiltrosBase(supabase.from("profrotas_abastecimentos").select("id", { count: "exact", head: true })).in(
        "id",
        idsRejeitada.length > 0 ? idsRejeitada : [-1]
      ),
      idsSemTentativa.length > 0
        ? aplicarFiltrosBase(supabase.from("profrotas_abastecimentos").select("id", { count: "exact", head: true })).not(
            "id",
            "in",
            `(${idsSemTentativa.join(",")})`
          )
        : aplicarFiltrosBase(supabase.from("profrotas_abastecimentos").select("id", { count: "exact", head: true })),
    ]);

    if (resultadoPagina.error) erro = resultadoPagina.error.message;
    registros = (resultadoPagina.data ?? []) as Registro[];
    totalRegistros = count ?? 0;
    contagemNf = {
      todos: countTodos ?? 0,
      emitida: countEmitida ?? 0,
      rejeitada: countRejeitada ?? 0,
      pendente: countPendente ?? 0,
    };

    const agregados = (agregadosRaw ?? []) as { item_quantidade: number | null; item_valor_total: number | null }[];
    volumeTotal = agregados.reduce((soma, r) => soma + (r.item_quantidade ?? 0), 0);
    receitaTotal = agregados.reduce((soma, r) => soma + (r.item_valor_total ?? 0), 0);
  }

  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, POR_PAGINA, page);
  const precoMedio = volumeTotal > 0 ? receitaTotal / volumeTotal : 0;

  function linkFiltro(extra: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const base = { cliente, q, de, ate, ajuste, nf: nf ?? undefined, ...extra };
    for (const [chave, valor] of Object.entries(base)) {
      if (valor) sp.set(chave, valor);
    }
    const qs = sp.toString();
    return qs ? `/abastecimentos?${qs}` : "/abastecimentos";
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Abastecimentos Fornecidos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Combustível que você forneceu aos seus clientes{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Abastecimentos" valor={totalRegistros.toLocaleString("pt-BR")} />
        <Indicador label="Volume total" valor={`${volumeTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
        <Indicador label="Receita total" valor={formatarMoeda(receitaTotal)} />
        <Indicador label="Preço médio/L" valor={formatarMoeda(precoMedio)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={linkFiltro({ combustivel: undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!combustivel ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Todos
        </Link>
        {PRODUTOS_POSTO.map((p) => (
          <Link
            key={p}
            href={linkFiltro({ combustivel: p })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${combustivel === p ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {p}
          </Link>
        ))}
        {/* Fase 27.68 — filtro pra ver só quem tem ajuste pendente, pra não
            precisar abrir registro por registro procurando a bolinha vermelha. */}
        <Link
          href={linkFiltro({ ajuste: ajuste === "pendente" ? undefined : "pendente" })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${ajuste === "pendente" ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          🔴 Pendente de ajuste
        </Link>
      </div>

      {/* Fase 27.102 — pedido do Daniel: mesmo filtro por status de NF-e já
          existente em /notas-fiscais, agora também aqui, onde o posto
          realmente acompanha o dia a dia. Cor por categoria igual ao badge
          da própria linha da tabela (verde/vermelho/âmbar), pra reconhecer
          de relance. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-slate-500">NF-e:</span>
        <Link
          href={linkFiltro({ nf: undefined })}
          className={`rounded-full px-3 py-1 font-medium ${!nf ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Todas ({contagemNf.todos})
        </Link>
        <Link
          href={linkFiltro({ nf: nf === "emitida" ? undefined : "emitida" })}
          className={`rounded-full px-3 py-1 font-medium ${nf === "emitida" ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Emitida ({contagemNf.emitida})
        </Link>
        <Link
          href={linkFiltro({ nf: nf === "rejeitada" ? undefined : "rejeitada" })}
          className={`rounded-full px-3 py-1 font-medium ${nf === "rejeitada" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Rejeitada ({contagemNf.rejeitada})
        </Link>
        <Link
          href={linkFiltro({ nf: nf === "pendente" ? undefined : "pendente" })}
          className={`rounded-full px-3 py-1 font-medium ${nf === "pendente" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Pendente ({contagemNf.pendente})
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="combustivel" value={combustivel ?? ""} />
        <input type="hidden" name="ajuste" value={ajuste ?? ""} />
        <input type="hidden" name="nf" value={nf ?? ""} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
          <select name="cliente" defaultValue={cliente ?? ""} className="input text-sm">
            <option value="">Todos os clientes</option>
            {clientesOpcoes.map((c) => (
              <option key={c.cnpj} value={c.cnpj}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por placa, motorista ou cliente..."
          className="input max-w-sm"
        />
        <input type="date" name="de" defaultValue={de ?? ""} className="input" title="Data inicial" />
        <input type="date" name="ate" defaultValue={ate ?? ""} className="input" title="Data final" />
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar abastecimentos: {erro}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Combustível</th>
              <th className="px-4 py-3">Litros</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">NF-e</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map((r) => {
              const numeroNf = notaPorAbastecimento.get(r.id);
              const pendencia = pendenciaPorAbastecimento.get(r.id);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">
                    <Link href={`/abastecimentos/${r.id}`} className="inline-flex items-center gap-1.5 font-medium text-frota-600 hover:underline">
                      {idsComAjusteAberto.has(r.id) && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                          title="Ajuste pendente neste abastecimento"
                        />
                      )}
                      {r.data_abastecimento ? formatDate(r.data_abastecimento) : "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.frota_razao_social ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.veiculo_placa ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.motorista_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.item_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.item_quantidade ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.item_valor_total != null ? formatarMoeda(r.item_valor_total) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {numeroNf !== undefined ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Emitida{numeroNf ? ` · Nº ${numeroNf}` : ""}
                      </span>
                    ) : pendencia ? (
                      <div>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rejeitada</span>
                        <p className="mt-1 max-w-xs text-xs text-red-600">
                          {pendencia.motivo === "erro_leitura_xml" && pendencia.detalheTexto
                            ? pendencia.detalheTexto
                            : mensagemMotivoPendencia(pendencia.motivo)}
                        </p>
                      </div>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pendente</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {registros.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nenhum abastecimento fornecido encontrado.
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
            paramsAtuais={{ combustivel, cliente, q, de, ate, ajuste, nf: nf ?? undefined }}
          />
        </div>
      </div>
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
