import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { AbasRoteirizacao } from "../_components/AbasRoteirizacao";
import { FormRoteirizacao } from "../_components/FormRoteirizacao";

export default async function RoteirizacaoPlanejarPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; rotaId?: string }>;
}) {
  const { empresa: empresaParam, rotaId } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  const { data: veiculosBrutos } = await supabase
    .from("cadastro_veiculos")
    .select("id, placa, modelo, tanque, autonomia, combustivel")
    .eq("ativo", true)
    .order("placa");
  const veiculos = veiculosBrutos ?? [];

  let estadoInicial = null;
  if (rotaId) {
    const { data: rota } = await supabase.from("rotas_salvas").select("dados").eq("id", rotaId).maybeSingle();
    const d = rota?.dados as Record<string, unknown> | undefined;
    if (d && d.origem && d.destino) {
      estadoInicial = {
        origem: d.origem as { label: string; lat: number; lon: number },
        destino: d.destino as { label: string; lat: number; lon: number },
        paradas: (d.paradas as { label: string; lat: number; lon: number }[]) ?? [],
        placa: (d.placa as string) ?? "",
        capacidade: (d.capacidade as number) ?? 80,
        autonomia: (d.autonomia as number) ?? 10,
        combustivel: (d.combustivel as string) ?? "",
        combustivelInicial: (d.combustivelInicial as number) ?? 0,
        perfilChave: (d.perfilChave as string) ?? "equilibrio",
      };
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Roteirizador Inteligente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Planeje onde abastecer numa viagem, com base no tanque e na autonomia do veículo.
        </p>
      </div>

      <AbasRoteirizacao ativo="planejar" />

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-3">
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
            Trocar
          </button>
        </form>
      )}

      {!empresaSelecionada ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Selecione um cliente para consultar a rede de postos dele.
        </p>
      ) : (
        <FormRoteirizacao empresaId={empresaSelecionada} veiculos={veiculos} estadoInicial={estadoInicial} />
      )}
    </div>
  );
}
