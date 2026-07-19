import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
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

  // Fase 27.37 — achado real: esta consulta não filtrava por empresa
  // NENHUMA — trazia os veículos ATIVOS DE TODOS OS CLIENTES da plataforma
  // no seletor de placa, não só do grupo econômico do cliente selecionado.
  // cadastro_veiculos não tem empresa_id (vínculo é por cnpj_frota,
  // normalizado de formas diferentes — ver Fase 27.5/14 no README), por
  // isso o filtro correto é via a RPC `veiculos_da_empresa`, mesmo padrão já
  // usado em /veiculos e no Dashboard.
  // Fase 27.38 — buscarTodosVeiculosDaEmpresa pagina essa RPC em lotes de
  // 1000 (limite padrão de resposta do Supabase/PostgREST) — sem isso,
  // clientes com mais de 1000 veículos não viam a frota inteira no
  // seletor de placa.
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

      {/* Fase 27.35 — mesmo aviso da aba "Por UF/Município": a rota já é
          traçada com preços da base pública ANP mesmo sem posto próprio
          cadastrado; ver comentário lá para o achado completo. */}
      <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
        💡 O planejamento já funciona com a base pública de preços ANP, mesmo sem nenhum posto
        próprio cadastrado. Carregar a rede negociada do cliente (em Postos Revendedores) é
        opcional e traz os preços realmente negociados.
      </p>

      <AbasRoteirizacao ativo="planejar" />

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
