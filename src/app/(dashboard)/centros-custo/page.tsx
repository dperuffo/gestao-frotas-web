import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

type SearchParams = { empresa?: string };

export default async function CentrosCustoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let centros: {
    id: string;
    nome: string;
    codigo: string | null;
    responsavel: string | null;
    ativo: boolean | null;
    cadastro_veiculos: { count: number }[];
  }[] = [];
  let error: { message: string } | null = null;

  if (empresaSelecionada) {
    const resultado = await supabase
      .from("centros_custo")
      .select("id, nome, codigo, responsavel, ativo, cadastro_veiculos(count)")
      .eq("empresa_id", empresaSelecionada)
      .order("nome");
    centros = resultado.data ?? [];
    error = resultado.error;
  }

  const totalCentros = centros.length;
  const totalAtivos = centros.filter((c) => c.ativo).length;
  const totalVeiculosAlocados = centros.reduce((soma, c) => soma + (c.cadastro_veiculos?.[0]?.count ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Centros de Custo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize a frota do cliente em centros de custo e acompanhe a alocação dos veículos.
          </p>
        </div>
        {empresaSelecionada && (
          <div className="flex gap-2">
            <Link href="/centros-custo/importar" className="btn-secondary">
              Importar planilha
            </Link>
            <Link href={`/centros-custo/novo?empresa=${empresaSelecionada}`} className="btn-primary">
              + Novo Centro de Custo
            </Link>
          </div>
        )}
      </div>

      {empresas.length > 1 && (
        <form className="mb-6 flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input">
              <option value="">Nenhum selecionado</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            Selecionar
          </button>
        </form>
      )}

      {!empresaSelecionada && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para ver os centros de custo dele.
        </p>
      )}

      {empresaSelecionada && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador label="Total de centros" valor={totalCentros} />
            <Indicador label="Ativos" valor={totalAtivos} />
            <Indicador label="Veículos alocados" valor={totalVeiculosAlocados} ajudaChave="centros_custo.veiculos_alocados" />
          </div>

          <div className="card overflow-x-auto">
            {error && <p className="p-4 text-sm text-red-600">Erro ao carregar centros de custo: {error.message}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Veículos alocados</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centros.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/centros-custo/${c.id}`} className="font-medium text-frota-600 hover:underline">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.codigo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.responsavel ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.cadastro_veiculos?.[0]?.count ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={c.ativo ? "badge-ativo" : "badge-inativo"}>{c.ativo ? "Ativo" : "Inativo"}</span>
                    </td>
                  </tr>
                ))}
                {centros.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhum centro de custo cadastrado para este cliente.
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

function Indicador({ label, valor, ajudaChave }: { label: string; valor: number; ajudaChave?: string }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
