import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { AbasRoteirizacao } from "../_components/AbasRoteirizacao";
import { FormConsultaPosto } from "../_components/FormConsultaPosto";

export default async function RoteirizacaoPostoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; termo?: string }>;
}) {
  const { empresa: empresaParam, termo } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Roteirização</h1>
        <p className="mt-1 text-sm text-slate-500">Busca livre por CNPJ ou nome do posto.</p>
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

      <AbasRoteirizacao ativo="posto" />

      {!empresaSelecionada ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para consultar a rede de postos dele.
        </p>
      ) : (
        <FormConsultaPosto empresaId={empresaSelecionada} termoInicial={termo} />
      )}
    </div>
  );
}
