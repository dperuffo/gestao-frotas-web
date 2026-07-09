import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { AbastecimentosPosto } from "./_components/AbastecimentosPosto";

const POR_PAGINA = 30;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusBadge(estornado: number | null, autorizacao: number | null) {
  if (estornado) return { texto: "Estornado", classe: "badge-inativo" };
  if (autorizacao === 1) return { texto: "Confirmado", classe: "badge-ativo" };
  return { texto: `Status ${autorizacao ?? "?"}`, classe: "badge-atencao" };
}

type RegistroAbastecimento = {
  id: string;
  data_abastecimento: string | null;
  veiculo_placa: string | null;
  motorista_nome: string | null;
  item_nome: string | null;
  item_quantidade: number | null;
  item_valor_unitario: number | null;
  item_valor_total: number | null;
  pv_razao_social: string | null;
  pv_municipio: string | null;
  pv_uf: string | null;
  abastecimento_estornado: number | null;
  status_autorizacao: number | null;
  identificador: string | null;
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
  }>;
}) {
  const { q, de, ate, empresa: empresaParam, page: pageParam, combustivel, cliente, ajuste, nf } = await searchParams;
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
          searchParams={{ combustivel, cliente, q, de, ate, page: pageParam, ajuste, nf }}
        />
      );
    }
  }

  // Fase 27.10 — achado real: abastecimentos com status_autorizacao = 0
  // (pendente, ainda não confirmado pela operadora) apareciam na lista junto
  // com os confirmados. A integração continua salvando tudo (ver
  // sincronizarProfrotas em src/lib/profrotas.ts — não descartamos o
  // registro, só deixamos de exibi-lo enquanto não for confirmado); quando a
  // operadora confirma, o próximo sync atualiza a mesma linha e ela passa a
  // aparecer normalmente. Lançamento manual e importação em planilha já
  // sempre gravam status_autorizacao = 1, então não são afetados.
  //
  // Fase 27.12 — a lista podia chegar a 500 linhas numa tela só (limit fixo,
  // sem paginação). Agora a tabela busca só a "página" atual (POR_PAGINA=30)
  // via .range() no banco; os KPIs (litros/valor/custo médio), porém,
  // continuam refletindo TODO o resultado filtrado — não só a página visível
  // — por isso rodam numa consulta de agregação separada (só as 2 colunas
  // numéricas necessárias, sem os demais campos da tabela).
  // Fase 27.68 — Daniel pediu um filtro pra ver só os abastecimentos com
  // ajuste pendente. Busca upfront os IDs (escopados à empresa selecionada —
  // a RLS já limita ao que envolve essa empresa) e reaproveita pra também
  // pintar a bolinha vermelha na linha (Fase 27.67), sem precisar de uma 2ª
  // consulta separada.
  let idsComAjusteAberto = new Set<number>();
  if (empresaSelecionada) {
    const { data: ajustesAbertosTodos } = await supabase
      .from("ajustes_abastecimentos")
      .select("abastecimento_id")
      .eq("empresa_cliente_id", empresaSelecionada)
      .in("status", ["pendente_cliente", "pendente_posto"]);
    idsComAjusteAberto = new Set((ajustesAbertosTodos ?? []).map((a) => a.abastecimento_id));
  }
  const idsFiltroAjuste = idsComAjusteAberto.size > 0 ? Array.from(idsComAjusteAberto) : [-1];

  // Builder genérico do supabase-js — usado pras 3 consultas (contagem,
  // agregados e página) com os mesmos filtros, por isso não dá pra tipar
  // exatamente igual ao retorno específico de cada .select() diferente.
  function comFiltros(builder: any) {
    let query = builder.eq("status_autorizacao", 1);
    if (q) query = query.or(`veiculo_placa.ilike.%${q}%,motorista_nome.ilike.%${q}%,pv_razao_social.ilike.%${q}%`);
    if (de) query = query.gte("data_abastecimento", de);
    if (ate) query = query.lte("data_abastecimento", `${ate}T23:59:59`);
    if (empresaSelecionada) query = query.eq("empresa_id", empresaSelecionada);
    if (ajuste === "pendente") query = query.in("id", idsFiltroAjuste);
    return query;
  }

  const offset = offsetDaPagina(POR_PAGINA, pageParam);

  const queryContagem = comFiltros(supabase.from("profrotas_abastecimentos").select("id", { count: "exact", head: true }));
  const queryAgregados = comFiltros(supabase.from("profrotas_abastecimentos").select("item_quantidade, item_valor_total")).limit(50000);
  const queryPagina = comFiltros(
    supabase
      .from("profrotas_abastecimentos")
      .select(
        "id, data_abastecimento, veiculo_placa, motorista_nome, item_nome, item_quantidade, item_valor_unitario, item_valor_total, pv_razao_social, pv_municipio, pv_uf, abastecimento_estornado, status_autorizacao, identificador"
      )
  )
    .order("data_abastecimento", { ascending: false })
    .range(offset, offset + POR_PAGINA - 1);

  const [{ count }, { data: agregadosRaw }, { data: registros, error }] = semClienteEscolhido
    ? [{ count: 0 }, { data: [] as { item_quantidade: number | null; item_valor_total: number | null }[] }, { data: [], error: null }]
    : await Promise.all([queryContagem, queryAgregados, queryPagina]);

  const totalRegistros = count ?? 0;
  const linhas = (registros ?? []) as RegistroAbastecimento[];
  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, POR_PAGINA, pageParam);

  const agregados = (agregadosRaw ?? []) as { item_quantidade: number | null; item_valor_total: number | null }[];
  const litrosTotais = agregados.reduce((soma: number, r) => soma + (r.item_quantidade ?? 0), 0);
  const valorTotal = agregados.reduce((soma: number, r) => soma + (r.item_valor_total ?? 0), 0);
  const custoMedioLitro = litrosTotais > 0 ? valorTotal / litrosTotais : 0;

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
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por placa, motorista ou posto..."
          className="input max-w-sm"
        />
        <input type="date" name="de" defaultValue={de ?? ""} className="input" title="Data inicial" />
        <input type="date" name="ate" defaultValue={ate ?? ""} className="input" title="Data final" />
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      {/* Fase 27.68 — filtro pra ver só quem tem ajuste pendente, pra não
          precisar abrir registro por registro procurando a bolinha vermelha. */}
      <div className="mb-4">
        <Link
          href={(() => {
            const sp = new URLSearchParams();
            const base = { empresa: empresaParam, q, de, ate, ajuste: ajuste === "pendente" ? undefined : "pendente" };
            for (const [chave, valor] of Object.entries(base)) if (valor) sp.set(chave, valor);
            const qs = sp.toString();
            return qs ? `/abastecimentos?${qs}` : "/abastecimentos";
          })()}
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
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Litros</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Posto</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((r) => {
              const status = statusBadge(r.abastecimento_estornado, r.status_autorizacao);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/abastecimentos/${r.id}`} className="inline-flex items-center gap-1.5 font-medium text-frota-600 hover:underline">
                      {idsComAjusteAberto.has(Number(r.id)) && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                          title="Ajuste pendente neste abastecimento"
                        />
                      )}
                      {r.data_abastecimento ? formatDate(r.data_abastecimento) : "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.veiculo_placa ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.motorista_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.item_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.item_quantidade ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.item_valor_total != null ? formatarMoeda(r.item_valor_total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[r.pv_razao_social, r.pv_municipio, r.pv_uf].filter(Boolean).join(" — ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={status.classe}>{status.texto}</span>
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
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
            paramsAtuais={{ q, de, ate, empresa: empresaParam, ajuste }}
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
