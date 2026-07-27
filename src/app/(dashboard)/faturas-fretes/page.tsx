import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const LABEL_STATUS: Record<string, string> = { aberta: "Aberta", paga: "Paga", cancelada: "Cancelada" };
const COR_STATUS: Record<string, string> = {
  aberta: "badge-ativo",
  paga: "text-xs font-medium text-frota-600",
  cancelada: "badge-inativo",
};

// Fase P0.6 (plano FNI_Plano_Implementacao_P0.md) — faturas de frete:
// agrupa CT-es autorizados por tomador e período.
export default async function FaturasFretesPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; q?: string }>;
}) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let faturasRaw: {
    id: string;
    numero_fatura: number;
    tomador_nome: string | null;
    tomador_cnpj: string;
    periodo_inicio: string;
    periodo_fim: string;
    vencimento: string;
    valor_total: number;
    quantidade_ctes: number;
    status: string;
  }[] = [];

  if (empresaSelecionada) {
    const { data } = await supabase
      .from("faturas_fretes")
      .select("id, numero_fatura, tomador_nome, tomador_cnpj, periodo_inicio, periodo_fim, vencimento, valor_total, quantidade_ctes, status")
      .eq("empresa_id", empresaSelecionada)
      .order("criado_em", { ascending: false })
      .limit(200);
    faturasRaw = data ?? [];
  }

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas que, com o tempo, acumulam muitos registros — uma fatura de
  // frete é gerada por período/tomador, cresce mês a mês sem limite
  // natural) — mesmo padrão ?q= já usado em /veiculos, /motoristas etc.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const faturas = termoBusca
    ? faturasRaw.filter(
        (f) =>
          f.tomador_nome?.toLowerCase().includes(termoBusca) ||
          f.tomador_cnpj?.toLowerCase().includes(termoBusca) ||
          String(f.numero_fatura).includes(termoBusca)
      )
    : faturasRaw;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">🧾 Faturas de Frete</h1>
          <p className="mt-1 text-sm text-slate-500">
            CT-es autorizados agrupados por tomador e período.{nomeEmpresaSelecionada ? ` Mostrando: ${nomeEmpresaSelecionada}.` : ""}
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/faturas-fretes/gerar?empresa=${empresaSelecionada}`} className="btn-primary">
            + Gerar fatura
          </Link>
        )}
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

      {empresaSelecionada && faturasRaw.length > 0 && (
        <form className="mb-4">
          <input type="hidden" name="empresa" value={empresaSelecionada} />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por tomador, CNPJ ou número..."
            className="input max-w-sm"
          />
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="p-4 text-sm text-slate-500">Selecione uma empresa acima pra ver e gerar faturas de frete.</p>
      ) : faturasRaw.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          Nenhuma fatura gerada ainda. Clique em &quot;+ Gerar fatura&quot; pra começar.
        </div>
      ) : faturas.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">Nenhuma fatura encontrada para &quot;{q}&quot;.</div>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Tomador</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">CT-es</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {faturas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{f.numero_fatura}</td>
                  <td className="px-4 py-3">
                    <Link href={`/faturas-fretes/${f.id}?empresa=${empresaSelecionada}`} className="font-medium text-frota-600 hover:underline">
                      {f.tomador_nome ?? f.tomador_cnpj}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(`${f.periodo_inicio}T00:00:00`).toLocaleDateString("pt-BR")} –{" "}
                    {new Date(`${f.periodo_fim}T00:00:00`).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(`${f.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-slate-600">{f.quantidade_ctes}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatoMoeda.format(f.valor_total)}</td>
                  <td className="px-4 py-3">
                    <span className={COR_STATUS[f.status] ?? "badge-inativo"}>{LABEL_STATUS[f.status] ?? f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
