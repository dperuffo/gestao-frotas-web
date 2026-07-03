import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusBadge(estornado: number | null, autorizacao: number | null) {
  if (estornado) return { texto: "Estornado", classe: "badge-inativo" };
  if (autorizacao === 1) return { texto: "Confirmado", classe: "badge-ativo" };
  return { texto: `Status ${autorizacao ?? "?"}`, classe: "badge-atencao" };
}

export default async function AbastecimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; de?: string; ate?: string; empresa?: string }>;
}) {
  const { q, de, ate, empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  // Fase 27.8 — mesmo seletor de cliente já usado em Postos, Relatórios,
  // Veículos e Motoristas, agora também em Abastecimentos.
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  // Fase 27.10 — achado real: abastecimentos com status_autorizacao = 0
  // (pendente, ainda não confirmado pela operadora) apareciam na lista junto
  // com os confirmados. A integração continua salvando tudo (ver
  // sincronizarProfrotas em src/lib/profrotas.ts — não descartamos o
  // registro, só deixamos de exibi-lo enquanto não for confirmado); quando a
  // operadora confirma, o próximo sync atualiza a mesma linha e ela passa a
  // aparecer normalmente. Lançamento manual e importação em planilha já
  // sempre gravam status_autorizacao = 1, então não são afetados.
  let query = supabase
    .from("profrotas_abastecimentos")
    .select(
      "id, data_abastecimento, veiculo_placa, motorista_nome, item_nome, item_quantidade, item_valor_unitario, item_valor_total, pv_razao_social, pv_municipio, pv_uf, abastecimento_estornado, status_autorizacao, identificador"
    )
    .eq("status_autorizacao", 1)
    .order("data_abastecimento", { ascending: false });

  if (q) {
    query = query.or(`veiculo_placa.ilike.%${q}%,motorista_nome.ilike.%${q}%,pv_razao_social.ilike.%${q}%`);
  }
  if (de) query = query.gte("data_abastecimento", de);
  if (ate) query = query.lte("data_abastecimento", `${ate}T23:59:59`);
  if (empresaSelecionada) query = query.eq("empresa_id", empresaSelecionada);

  const { data: registros, error } = semClienteEscolhido ? { data: [], error: null } : await query.limit(500);

  const litrosTotais = registros?.reduce((soma, r) => soma + (r.item_quantidade ?? 0), 0) ?? 0;
  const valorTotal = registros?.reduce((soma, r) => soma + (r.item_valor_total ?? 0), 0) ?? 0;
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
        <Indicador label="Registros" valor={String(registros?.length ?? 0)} />
        <Indicador label="Litros abastecidos" valor={litrosTotais.toLocaleString("pt-BR")} />
        <Indicador label="Valor total" valor={formatarMoeda(valorTotal)} />
        <Indicador label="Custo médio por litro" valor={formatarMoeda(custoMedioLitro)} />
      </div>

      <form className="mb-4 flex flex-wrap gap-3">
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
            {registros?.map((r) => {
              const status = statusBadge(r.abastecimento_estornado, r.status_autorizacao);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/abastecimentos/${r.id}`} className="font-medium text-frota-600 hover:underline">
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
            {registros?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nenhum abastecimento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
