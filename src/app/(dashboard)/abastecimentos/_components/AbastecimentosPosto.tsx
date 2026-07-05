import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PRODUTOS_POSTO } from "@/lib/constants";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type SearchParamsPosto = { combustivel?: string };

// Fase 27.58 — visão do posto na mesma tela /abastecimentos: o que ele
// FORNECEU (não o que consumiu — isso é o lado cliente, acima em
// AbastecimentosPage). O robô grava pv_cnpj com o CNPJ do posto (ver
// gerar_abastecimentos_postos_robo em Supabase); a RLS
// profrotas_abastecimentos_leitura_posto libera a leitura pra quem for
// dono desse CNPJ. Sem seletor de cliente aqui — o posto já é sempre uma
// única empresa (não tem grupo econômico como Frota).
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
  const { combustivel } = searchParams;

  const { data: empresa } = await supabase.from("empresas").select("cnpj").eq("id", empresaPostoId).maybeSingle();
  const meuCnpj = empresa?.cnpj;

  let registros: {
    id: number;
    data_abastecimento: string | null;
    frota_razao_social: string | null;
    veiculo_placa: string | null;
    motorista_nome: string | null;
    item_nome: string | null;
    item_quantidade: number | null;
    item_valor_unitario: number | null;
    item_valor_total: number | null;
  }[] = [];
  let erro: string | undefined;

  if (meuCnpj) {
    let query = supabase
      .from("profrotas_abastecimentos")
      .select(
        "id, data_abastecimento, frota_razao_social, veiculo_placa, motorista_nome, item_nome, item_quantidade, item_valor_unitario, item_valor_total"
      )
      .eq("pv_cnpj", meuCnpj)
      .order("data_abastecimento", { ascending: false })
      .limit(500);

    if (combustivel && (PRODUTOS_POSTO as readonly string[]).includes(combustivel)) {
      query = query.eq("item_nome", combustivel);
    }

    const resultado = await query;
    if (resultado.error) erro = resultado.error.message;
    registros = resultado.data ?? [];
  }

  const volumeTotal = registros.reduce((soma, r) => soma + (r.item_quantidade ?? 0), 0);
  const receitaTotal = registros.reduce((soma, r) => soma + (r.item_valor_total ?? 0), 0);
  const precoMedio = volumeTotal > 0 ? receitaTotal / volumeTotal : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Abastecimentos Fornecidos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Combustível que você forneceu aos seus clientes{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Abastecimentos" valor={registros.length.toLocaleString("pt-BR")} />
        <Indicador label="Volume total" valor={`${volumeTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
        <Indicador label="Receita total" valor={formatarMoeda(receitaTotal)} />
        <Indicador label="Preço médio/L" valor={formatarMoeda(precoMedio)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/abastecimentos"
          className={`rounded-full px-3 py-1 text-xs font-medium ${!combustivel ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Todos
        </Link>
        {PRODUTOS_POSTO.map((p) => (
          <Link
            key={p}
            href={`/abastecimentos?combustivel=${encodeURIComponent(p)}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${combustivel === p ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {p}
          </Link>
        ))}
      </div>

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
                  {r.data_abastecimento ? formatDate(r.data_abastecimento) : "—"}
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
