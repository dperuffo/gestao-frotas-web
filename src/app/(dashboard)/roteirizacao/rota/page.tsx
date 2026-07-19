import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { AbasRoteirizacao } from "../_components/AbasRoteirizacao";
import { FormPorRota } from "../_components/FormPorRota";

export default async function RoteirizacaoRotaPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; rotaId?: string }>;
}) {
  const { empresa: empresaParam, rotaId } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  let estadoInicial = null;
  if (rotaId) {
    const { data: rota } = await supabase.from("rotas_salvas").select("dados").eq("id", rotaId).maybeSingle();
    const d = rota?.dados as Record<string, unknown> | undefined;
    if (d && d.origem && d.destino) {
      estadoInicial = {
        origem: d.origem as { label: string; lat: number; lon: number },
        destino: d.destino as { label: string; lat: number; lon: number },
        paradas: (d.paradas as { label: string; lat: number; lon: number }[]) ?? [],
        raioKm: (d.raioKm as number) ?? 5,
      };
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Roteirização</h1>
        <p className="mt-1 text-sm text-slate-500">
          Trace uma rota entre dois pontos e veja quais postos da rede ficam no caminho.
        </p>
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

      <AbasRoteirizacao ativo="rota" />

      {!empresaSelecionada ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para consultar a rede de postos dele.
        </p>
      ) : (
        <FormPorRota empresaId={empresaSelecionada} estadoInicial={estadoInicial} />
      )}
    </div>
  );
}
