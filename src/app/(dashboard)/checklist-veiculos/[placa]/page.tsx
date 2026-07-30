import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { RegistrarInspecaoForm } from "../_components/RegistrarInspecaoForm";
import { HistoricoInspecoes } from "../_components/HistoricoInspecoes";

type SearchParams = { empresa?: string };

export default async function DetalheChecklistVeiculoPage({
  params,
  searchParams,
}: {
  params: Promise<{ placa: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { placa: placaParam } = await params;
  const placa = decodeURIComponent(placaParam).toUpperCase();
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  if (!empresaSelecionada) {
    return (
      <div>
        <Link href="/checklist-veiculos" className="mb-4 inline-block text-sm text-frota-600 hover:underline">
          ← Voltar
        </Link>
        <div className="card max-w-lg space-y-4 p-6">
          <p className="text-sm text-slate-600">Selecione o cliente para ver o checklist deste veículo.</p>
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
              Ver
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { data: veiculo } = await supabase
    .from("cadastro_veiculos")
    .select("marca, modelo, tipo_veiculo, centros_custo(nome)")
    .eq("placa", placa)
    .maybeSingle();

  const { data: ultimoHodometro } = await supabase
    .from("abastecimentos_unificado")
    .select("hodometro")
    .eq("placa", placa)
    .order("hodometro", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: inspecoesRaw } = await supabase
    .from("inspecoes_veiculos")
    .select(
      "id, data_inspecao, hodometro, responsavel, criado_por, inspecoes_veiculos_itens(id, item, critico, conforme, observacao, resolvido_em, resolvido_por)"
    )
    .eq("placa", placa)
    .order("data_inspecao", { ascending: false })
    .limit(50);

  const inspecoes = (inspecoesRaw ?? []).map((i) => ({
    id: i.id,
    data_inspecao: i.data_inspecao,
    hodometro: i.hodometro,
    responsavel: i.responsavel,
    criado_por: i.criado_por,
    itens: i.inspecoes_veiculos_itens ?? [],
  }));

  const centroCusto = (veiculo?.centros_custo as { nome: string } | null)?.nome;

  return (
    <div>
      <Link href="/checklist-veiculos" className="mb-4 inline-block text-sm text-frota-600 hover:underline">
        ← Voltar
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{placa}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {[veiculo?.marca, veiculo?.modelo].filter(Boolean).join(" ") || "Sem marca/modelo cadastrado"}
          {veiculo?.tipo_veiculo ? ` · ${veiculo.tipo_veiculo}` : ""}
          {centroCusto ? ` · ${centroCusto}` : ""}
        </p>
      </div>

      <div className="mb-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">✅ Registrar Nova Inspeção</h2>
        <RegistrarInspecaoForm empresaId={empresaSelecionada} placa={placa} kmAtual={ultimoHodometro?.hodometro ?? 0} />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">📋 Histórico de Inspeções</h2>
        <HistoricoInspecoes placa={placa} inspecoes={inspecoes} />
      </div>
    </div>
  );
}
