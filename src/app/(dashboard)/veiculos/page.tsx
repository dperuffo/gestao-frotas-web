import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ToggleAtivoVeiculo } from "./_components/ToggleAtivoVeiculo";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export default async function VeiculosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("cadastro_veiculos")
    .select("id, placa, marca, modelo, tipo_veiculo, classificacao, ativo, centro_custo_nome, municipio, uf_veiculo")
    .order("placa");

  if (q) {
    query = query.or(`placa.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%`);
  }

  const { data: veiculos, error } = await query;

  const { count: totalAtivos } = await supabase
    .from("cadastro_veiculos")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true);

  const { count: totalGeral } = await supabase.from("cadastro_veiculos").select("id", { count: "exact", head: true });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Veículos <AjudaIcon chave="veiculos.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">Cadastro da frota, especificações técnicas e centro de custo.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/veiculos/importar" className="btn-secondary">
            Importar planilha
          </Link>
          <Link href="/veiculos/novo" className="btn-primary">
            + Novo Veículo
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador label="Total de veículos" valor={totalGeral ?? 0} />
        <Indicador label="Ativos" valor={totalAtivos ?? 0} />
        <Indicador label="Inativos" valor={(totalGeral ?? 0) - (totalAtivos ?? 0)} />
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por placa, marca ou modelo..."
          className="input max-w-sm"
        />
      </form>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar veículos: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Marca/Modelo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Classificação</th>
              <th className="px-4 py-3">Centro de custo</th>
              <th className="px-4 py-3">Localização</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {veiculos?.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/veiculos/${v.id}`} className="font-medium text-frota-600 hover:underline">
                    {v.placa}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{v.tipo_veiculo ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{v.classificacao ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{v.centro_custo_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[v.municipio, v.uf_veiculo].filter(Boolean).join("/") || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={v.ativo ? "badge-ativo" : "badge-inativo"}>{v.ativo ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="px-4 py-3">
                  <ToggleAtivoVeiculo id={v.id} ativo={v.ativo ?? false} />
                </td>
              </tr>
            ))}
            {veiculos?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nenhum veículo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
