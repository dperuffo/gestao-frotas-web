import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";

type SearchParams = { empresa?: string };

export default async function RotogramaListaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let query = supabase
    .from("rotogramas")
    .select("id, numero, origem, destino, motorista, placa, data_viagem, criado_em, empresas(nome)")
    .order("criado_em", { ascending: false });

  if (empresaSelecionada) query = query.eq("empresa_id", empresaSelecionada);

  const { data: rotogramas, error } = await query;

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
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input max-w-sm">
              <option value="">Todos os clientes</option>
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
            {rotogramas?.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
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
