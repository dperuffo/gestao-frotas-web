import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/estoquePecas";
// Fase Redesign-Telas-Densas (12/08/2026) — mesmo toque visual já aplicado
// nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Boxes, AlertTriangle, Wallet } from "lucide-react";
import { GraficoEstoquePecas, type ItemRankingValor } from "./_components/GraficoEstoquePecas";

type SearchParams = { empresa?: string; q?: string };

// Fase Grupo 1 Rodopar item 2 (03/08/2026) — Estoque de Peças na Manutenção.
// Gap do benchmark Rodopar/Datapar: FNI tinha manutencoes_realizadas com
// itens_realizados em texto livre, sem controle real de peças. Aqui: um
// catálogo (pecas_estoque) com saldo/custo médio calculado a partir de um
// ledger imutável de movimentos (pecas_estoque_movimentos), aplicado por
// trigger no banco — nunca editado direto na tela.
export default async function EstoquePecasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  type PecaLinha = {
    id: string;
    nome: string;
    codigo: string | null;
    unidade_medida: string;
    quantidade_atual: number;
    quantidade_minima: number;
    custo_unitario_medio: number | null;
    ativa: boolean;
  };

  // Fase Auditoria-Paginacao (17/08/2026) — achado real: busca o catálogo de
  // peças inteiro sem `.range()` — sujeita ao corte padrão de 1.000 linhas
  // do PostgREST em catálogos grandes (mesmo bug já corrigido em /veiculos,
  // Fase 27.38). Busca em lotes de 1.000 até esgotar.
  const LOTE_PECAS = 1000;
  const pecasRaw: PecaLinha[] = [];
  if (empresaSelecionada) {
    let offsetBusca = 0;
    for (;;) {
      const { data } = await supabase
        .from("pecas_estoque")
        .select("id, nome, codigo, unidade_medida, quantidade_atual, quantidade_minima, custo_unitario_medio, ativa")
        .eq("empresa_id", empresaSelecionada)
        .order("nome")
        .range(offsetBusca, offsetBusca + LOTE_PECAS - 1);
      const lote = (data ?? []) as PecaLinha[];
      if (lote.length === 0) break;
      pecasRaw.push(...lote);
      if (lote.length < LOTE_PECAS) break;
      offsetBusca += LOTE_PECAS;
    }
  }

  const termoBusca = (q ?? "").trim().toLowerCase();
  const pecas = termoBusca
    ? pecasRaw.filter((p) => p.nome.toLowerCase().includes(termoBusca) || p.codigo?.toLowerCase().includes(termoBusca))
    : pecasRaw;

  const ativas = pecasRaw.filter((p) => p.ativa);
  const abaixoDoMinimo = ativas.filter((p) => p.quantidade_atual <= p.quantidade_minima);
  const valorEmEstoque = ativas.reduce((s, p) => s + p.quantidade_atual * (p.custo_unitario_medio ?? 0), 0);

  // Fase Plano-Graficos Onda 1 (04/09/2026) — agregações do gráfico, todas
  // a partir do pecasRaw já carregado (sem query nova).
  const percentualAbaixoMinimo = ativas.length > 0 ? Math.round((abaixoDoMinimo.length / ativas.length) * 100) : 0;
  const totalOk = ativas.length - abaixoDoMinimo.length;
  const totalRepor = abaixoDoMinimo.length;
  const rankingValor: ItemRankingValor[] = [...ativas]
    .map((p) => ({ nome: p.nome, valor: p.quantidade_atual * (p.custo_unitario_medio ?? 0) }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)
    .reverse();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Estoque de Peças</h1>
          <p className="mt-1 text-sm text-slate-500">
            Catálogo de peças da Manutenção, com saldo e custo médio calculados a partir das entradas e saídas registradas.
          </p>
        </div>
        {empresaSelecionada && (
          <Link href={`/estoque-pecas/nova?empresa=${empresaSelecionada}`} className="btn-primary text-sm">
            + Nova Peça
          </Link>
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-2">
        {empresas.length > 1 && (
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
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input type="search" name="q" defaultValue={q ?? ""} placeholder="Nome ou código..." className="input text-sm" />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      {!empresaSelecionada ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver o estoque de peças da frota dele.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndicadorColorido cor="sky" icon={Boxes} label="Peças ativas" valor={String(ativas.length)} />
            <IndicadorColorido
              cor={abaixoDoMinimo.length > 0 ? "red" : "green"}
              icon={AlertTriangle}
              label="Abaixo do estoque mínimo"
              valor={String(abaixoDoMinimo.length)}
            />
            <IndicadorColorido cor="violet" icon={Wallet} label="Valor em estoque" valor={formatarMoeda(valorEmEstoque)} />
          </div>

          <GraficoEstoquePecas
            percentualAbaixoMinimo={percentualAbaixoMinimo}
            totalOk={totalOk}
            totalRepor={totalRepor}
            rankingValor={rankingValor}
          />

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Saldo</th>
                  <th className="px-4 py-3">Mínimo</th>
                  <th className="px-4 py-3">Custo médio</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pecas.map((p) => {
                  const abaixo = p.quantidade_atual <= p.quantidade_minima;
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-frota-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/estoque-pecas/${p.id}?empresa=${empresaSelecionada}`} className="font-medium text-frota-600 hover:underline">
                          {p.nome}
                        </Link>
                        {!p.ativa && <span className="ml-2 text-xs text-slate-400">(inativa)</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.codigo ?? "—"}</td>
                      <td className={`px-4 py-3 tabular-nums font-medium ${abaixo ? "text-red-700" : "text-slate-700"}`}>
                        {p.quantidade_atual} {p.unidade_medida}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {p.quantidade_minima} {p.unidade_medida}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">{formatarMoeda(p.custo_unitario_medio)}</td>
                      <td className="px-4 py-3">
                        {abaixo ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">Repor</span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {pecas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma peça cadastrada ainda.
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
