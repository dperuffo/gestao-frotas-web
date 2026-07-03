import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { NovoCentroCustoForm } from "../_components/NovoCentroCustoForm";

type SearchParams = { empresa?: string };

export default async function NovoCentroCustoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Centro de Custo</h1>

      {!empresaSelecionada ? (
        <div className="card max-w-lg space-y-4 p-6">
          <p className="text-sm text-slate-600">Selecione o cliente para o qual este centro de custo será criado.</p>
          <form className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
              <select name="empresa" defaultValue="" className="input">
                <option value="">Selecione...</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary">
              Continuar
            </button>
          </form>
        </div>
      ) : (
        <NovoCentroCustoForm empresaId={empresaSelecionada} nomeEmpresa={nomeEmpresaSelecionada ?? ""} />
      )}
    </div>
  );
}
