import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { GraficoRotograma } from "./_components/GraficoRotograma";

type SearchParams = { empresa?: string; q?: string };

export default async function RotogramaListaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  // Fase Auditoria-Paginacao (17/08/2026) — achado real: esta tela já
  // reconhecia no comentário abaixo que "cresce sem limite natural", mas a
  // busca continuava numa query só, sem `.range()` — sujeita ao corte
  // padrão de 1.000 linhas do PostgREST (mesma classe de bug já corrigida
  // em /veiculos, Fase 27.38, e /chamados). Busca em lotes de 1.000 até
  // esgotar.
  const LOTE_ROTOGRAMAS = 1000;
  function buscarLoteRotogramas(offset: number) {
    let query = supabase
      .from("rotogramas")
      .select("id, numero, origem, destino, motorista, placa, data_viagem, criado_em, empresas(nome)")
      .order("criado_em", { ascending: false })
      .range(offset, offset + LOTE_ROTOGRAMAS - 1);

    if (empresaSelecionada) query = query.eq("empresa_id", empresaSelecionada);
    return query;
  }

  type LinhaRotograma = NonNullable<Awaited<ReturnType<typeof buscarLoteRotogramas>>["data"]>[number];
  const rotogramasRaw: LinhaRotograma[] = [];
  let error: { message: string } | null = null;
  {
    let offsetBusca = 0;
    for (;;) {
      const { data: lote, error: erroLote } = await buscarLoteRotogramas(offsetBusca);
      if (erroLote) {
        error = erroLote;
        break;
      }
      if (!lote || lote.length === 0) break;
      rotogramasRaw.push(...lote);
      if (lote.length < LOTE_ROTOGRAMAS) break;
      offsetBusca += LOTE_ROTOGRAMAS;
    }
  }

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas que, com o tempo, acumulam muitos registros — um Rotograma é
  // gerado a cada viagem planejada, cresce sem limite natural) — mesmo
  // padrão ?q= já usado em /veiculos, /motoristas etc.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const rotogramas = termoBusca
    ? (rotogramasRaw ?? []).filter((r) =>
        [r.origem, r.destino, r.motorista, r.placa]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(termoBusca))
      )
    : (rotogramasRaw ?? []);

  // Fase Plano-Graficos Onda 5 (04/09/2026, pedido do Daniel) — volume
  // mensal (últimos 6 meses) e top 5 rotas mais frequentes, a partir de
  // todos os rotogramas já carregados acima (rotogramasRaw, não afetado
  // pelo filtro de busca ?q=, pra manter uma visão geral do total).
  const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const agora = new Date();
  const baldesMes: { chave: string; mes: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    baldesMes.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, mes: `${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
  }
  const contagemPorMes = new Map(baldesMes.map((b) => [b.chave, 0]));
  for (const r of rotogramasRaw) {
    if (!r.criado_em) continue;
    const d = new Date(r.criado_em);
    const chave = `${d.getFullYear()}-${d.getMonth()}`;
    if (contagemPorMes.has(chave)) contagemPorMes.set(chave, (contagemPorMes.get(chave) ?? 0) + 1);
  }
  const volumePorMes = baldesMes.map((b) => ({ mes: b.mes, total: contagemPorMes.get(b.chave) ?? 0 }));

  const contagemPorRota = new Map<string, number>();
  for (const r of rotogramasRaw) {
    if (!r.origem || !r.destino) continue;
    const rota = `${r.origem} → ${r.destino}`;
    contagemPorRota.set(rota, (contagemPorRota.get(rota) ?? 0) + 1);
  }
  const topRotas = Array.from(contagemPorRota.entries())
    .map(([rota, total]) => ({ rota, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rotograma de Segurança</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mapa de pontos de risco, paradas e contatos de emergência para o motorista levar na viagem.
          </p>
        </div>
        <Link href="/rotograma/novo" className="btn-primary">
          + Novo Rotograma
        </Link>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input max-w-sm text-sm">
              <option value="">Todos os clientes</option>
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

      <form className="mb-4">
        <input type="hidden" name="empresa" value={empresaParam ?? ""} />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por origem, destino, motorista ou placa..."
          className="input max-w-sm"
        />
      </form>

      <GraficoRotograma volumePorMes={volumePorMes} topRotas={topRotas} />

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar Rotogramas: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Rota</th>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Data da viagem</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rotogramas.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-frota-50/60">
                <td className="px-4 py-3 text-slate-500">{r.numero}</td>
                <td className="px-4 py-3">
                  <Link href={`/rotograma/${r.id}`} className="font-medium text-frota-600 hover:underline">
                    {r.origem} → {r.destino}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.motorista ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{r.placa ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{r.data_viagem ? formatDate(r.data_viagem) : "—"}</td>
                <td className="px-4 py-3 text-slate-600">{r.empresas?.nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(r.criado_em)}</td>
              </tr>
            ))}
            {rotogramas?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum Rotograma cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
