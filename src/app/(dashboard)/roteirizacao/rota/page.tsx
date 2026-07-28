import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
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

  // Fase Seleção-Manual-de-Postos (28/07/2026) — este modo evoluiu de
  // "só mostrar postos no corredor" para "gestor escolhe onde abastecer",
  // por isso agora também precisa da frota do cliente pro seletor de placa
  // (mesmo padrão do Roteirizador Inteligente, ver planejar/page.tsx).
  const { data: veiculosDaEmpresaRaw } = empresaSelecionada
    ? await buscarTodosVeiculosDaEmpresa(supabase, empresaSelecionada)
    : { data: [] };
  const veiculos = (veiculosDaEmpresaRaw ?? [])
    .filter((v) => v.ativo)
    .map((v) => ({
      id: v.id,
      placa: v.placa,
      modelo: v.modelo,
      tanque: v.tanque,
      autonomia: v.autonomia,
      combustivel: v.combustivel,
    }))
    .sort((a, b) => a.placa.localeCompare(b.placa));

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
        placa: (d.placa as string) ?? "",
        capacidade: (d.capacidade as number) ?? 80,
        autonomia: (d.autonomia as number) ?? 10,
        combustivel: (d.combustivel as string) ?? "",
        combustivelInicial: (d.combustivelInicial as number) ?? 0,
      };
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Escolher Postos Manualmente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Trace a rota, informe o veículo e escolha você mesmo em quais postos o motorista vai abastecer.
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
        <FormPorRota empresaId={empresaSelecionada} veiculos={veiculos} estadoInicial={estadoInicial} />
      )}
    </div>
  );
}
