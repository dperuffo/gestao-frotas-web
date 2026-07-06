import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PRODUTOS_POSTO } from "@/lib/constants";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";

const POR_PAGINA = 30;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type SearchParamsPosto = { combustivel?: string; cliente?: string; q?: string; de?: string; ate?: string; page?: string };

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
  const { combustivel, cliente, q, de, ate, page } = searchParams;

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

    function comFiltros<T extends { eq: (...args: [string, string]) => T; or: (arg: string) => T; gte: (...args: [string, string]) => T; lte: (...args: [string, string]) => T }>(
      builder: T
    ): T {
      let query = builder.eq("pv_cnpj", meuCnpj as string);
      if (combustivel && (PRODUTOS_POSTO as readonly string[]).includes(combustivel)) {
        query = query.eq("item_nome", combustivel);
      }
      if (cliente) query = query.eq("cnpj_frota", cliente);
      if (q) query = query.or(`veiculo_placa.ilike.%${q}%,motorista_nome.ilike.%${q}%,frota_razao_social.ilike.%${q}%`);
      if (de) query = query.gte("data_abastecimento", de);
      if (ate) query = query.lte("data_abastecimento", `${ate}T23:59:59`);
      return query;
    }

    const [{ count }, { data: agregadosRaw }, resultadoPagina] = await Promise.all([
      comFiltros(supabase.from("profrotas_abastecimentos").select("id", { count: "exact", head: true })),
      comFiltros(supabase.from("profrotas_abastecimentos").select("item_quantidade, item_valor_total")).limit(50000),
      comFiltros(
        supabase
          .from("profrotas_abastecimentos")
          .select(
            "id, data_abastecimento, frota_razao_social, cnpj_frota, veiculo_placa, motorista_nome, item_nome, item_quantidade, item_valor_unitario, item_valor_total"
          )
      )
        .order("data_abastecimento", { ascending: false })
        .range(offset, offset + POR_PAGINA - 1),
    ]);

    if (resultadoPagina.error) erro = resultadoPagina.error.message;
    registros = (resultadoPagina.data ?? []) as Registro[];
    totalRegistros = count ?? 0;

    const agregados = (agregadosRaw ?? []) as { item_quantidade: number | null; item_valor_total: number | null }[];
    volumeTotal = agregados.reduce((soma, r) => soma + (r.item_quantidade ?? 0), 0);
    receitaTotal = agregados.reduce((soma, r) => soma + (r.item_valor_total ?? 0), 0);

    // Fase 27.67 — Daniel pediu um indicador na PRÓPRIA linha do registro (não
    // só o badge agregado do menu), pros dois lados verem de cara qual
    // abastecimento tem um ajuste em andamento. Consulta só os IDs da página
    // atual (a RLS já limita a resultado a ajustes que envolvem este posto).
    if (registros.length > 0) {
      const { data: ajustesAbertos } = await supabase
        .from("ajustes_abastecimentos")
        .select("abastecimento_id")
        .in("abastecimento_id", registros.map((r) => r.id))
        .in("status", ["pendente_cliente", "pendente_posto"]);
      idsComAjusteAberto = new Set((ajustesAbertos ?? []).map((a) => a.abastecimento_id));
    }
  }

  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, POR_PAGINA, page);
  const precoMedio = volumeTotal > 0 ? receitaTotal / volumeTotal : 0;

  function linkFiltro(extra: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const base = { cliente, q, de, ate, ...extra };
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
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="combustivel" value={combustivel ?? ""} />
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registros.map((r) => (
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
              </tr>
            ))}
            {registros.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
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
            paramsAtuais={{ combustivel, cliente, q, de, ate }}
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
