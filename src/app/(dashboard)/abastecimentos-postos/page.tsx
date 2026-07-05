import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarDataBr } from "@/lib/utils";
import { formatarMoeda } from "@/lib/financeiro";
import { PRODUTOS_POSTO } from "@/lib/constants";

type SearchParams = { empresa?: string; combustivel?: string };

// Fase 27.55 — Abastecimentos por Posto. Uma única tela serve os dois lados
// (mesmo espírito de /negociacoes): o cliente vê os abastecimentos que
// recebeu de cada posto parceiro; o posto vê os abastecimentos que forneceu
// a cada cliente. Os registros hoje são gerados por um robô (pg_cron, a
// cada 6h — ver função gerar_abastecimentos_postos_robo no banco), que
// simula consumo dentro do volume mínimo mensal de cada negociação aceita e
// vigente. `origem` já está preparado pra registros futuros via API
// ("api") ou lançamento manual ("manual"), mas por ora só "robo" existe.
export default async function AbastecimentosPostosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam, combustivel } = await searchParams;
  const supabase = await createClient();

  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let segmentoSelecionado: string | null = null;
  if (empresaSelecionada) {
    const { data } = await supabase.from("empresas").select("segmento").eq("id", empresaSelecionada).maybeSingle();
    segmentoSelecionado = data?.segmento ?? null;
  }
  const souPosto = segmentoSelecionado === "Revenda";

  let registros: {
    id: string;
    negociacao_id: string;
    data_abastecimento: string;
    combustivel: string;
    volume_litros: number;
    preco_unitario: number;
    valor_total: number;
    origem: string;
    negociacoes_postos: { cliente_nome: string | null; posto_nome: string | null } | null;
  }[] = [];
  let erro: string | undefined;

  if (empresaSelecionada) {
    let query = supabase
      .from("abastecimentos_postos")
      .select(
        "id, negociacao_id, data_abastecimento, combustivel, volume_litros, preco_unitario, valor_total, origem, negociacoes_postos(cliente_nome, posto_nome)"
      )
      .order("data_abastecimento", { ascending: false })
      .limit(500);

    query = souPosto
      ? query.eq("empresa_posto_id", empresaSelecionada)
      : query.eq("empresa_cliente_id", empresaSelecionada);

    if (combustivel && (PRODUTOS_POSTO as readonly string[]).includes(combustivel)) {
      query = query.eq("combustivel", combustivel);
    }

    const resultado = await query;
    if (resultado.error) erro = resultado.error.message;
    registros = (resultado.data ?? []) as typeof registros;
  }

  const volumeTotal = registros.reduce((soma, r) => soma + r.volume_litros, 0);
  const valorTotal = registros.reduce((soma, r) => soma + r.valor_total, 0);
  const precoMedio = volumeTotal > 0 ? valorTotal / volumeTotal : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          {souPosto ? "Abastecimentos Fornecidos" : "Abastecimentos Recebidos de Postos"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {souPosto
            ? "Combustível fornecido aos seus clientes, sob as negociações aceitas e vigentes."
            : "Combustível recebido dos postos parceiros, sob as negociações aceitas e vigentes com cada um."}
        </p>
      </div>

      {empresas.length > 1 && (
        <form className="mb-6 flex items-end gap-2">
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
            Aplicar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">
          {empresas.length > 1 ? "Selecione uma empresa acima." : "Nenhuma empresa vinculada ao seu usuário."}
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Indicador label="Abastecimentos" valor={registros.length.toLocaleString("pt-BR")} />
            <Indicador label="Volume total" valor={`${volumeTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
            <Indicador label={souPosto ? "Receita total" : "Custo total"} valor={formatarMoeda(valorTotal)} />
            <Indicador label="Preço médio/L" valor={formatarMoeda(precoMedio)} />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <a
              href={`/abastecimentos-postos?empresa=${empresaSelecionada}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${!combustivel ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Todos
            </a>
            {PRODUTOS_POSTO.map((p) => (
              <a
                key={p}
                href={`/abastecimentos-postos?empresa=${empresaSelecionada}&combustivel=${encodeURIComponent(p)}`}
                className={`rounded-full px-3 py-1 text-xs font-medium ${combustivel === p ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {p}
              </a>
            ))}
          </div>

          {erro && <p className="mb-4 text-sm text-red-600">Erro ao carregar abastecimentos: {erro}</p>}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{souPosto ? "Cliente" : "Posto"}</th>
                  <th className="px-4 py-3">Combustível</th>
                  <th className="px-4 py-3">Volume (L)</th>
                  <th className="px-4 py-3">Preço/L</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registros.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {souPosto ? (r.negociacoes_postos?.cliente_nome ?? "—") : (r.negociacoes_postos?.posto_nome ?? "—")}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.combustivel}</td>
                    <td className="px-4 py-3 text-slate-500">{r.volume_litros.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-slate-500">{formatarMoeda(r.preco_unitario)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatarMoeda(r.valor_total)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatarDataBr(r.data_abastecimento.slice(0, 10))}
                    </td>
                  </tr>
                ))}
                {registros.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhum abastecimento encontrado{nomeEmpresaSelecionada ? ` para ${nomeEmpresaSelecionada}` : ""}.
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
