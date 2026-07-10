import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarTodosVeiculosDaEmpresa } from "@/lib/veiculos";
import { VinculoForm } from "../../_components/VinculoForm";

export default async function EditarVinculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vinculo } = await supabase
    .from("parametros_vinculo_motorista_veiculo")
    .select("id, empresa_id, placa, motorista_id, data_inicio, data_fim, observacao, status")
    .eq("id", id)
    .maybeSingle();

  if (!vinculo) notFound();

  const [{ data: veiculos }, { data: motoristas }] = await Promise.all([
    buscarTodosVeiculosDaEmpresa(supabase, vinculo.empresa_id),
    supabase
      .from("motoristas")
      .select("id, nome_completo, cpf")
      .eq("empresa_id", vinculo.empresa_id)
      .order("nome_completo"),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Vínculo</h1>
      <VinculoForm
        vinculo={vinculo}
        empresaId={vinculo.empresa_id}
        veiculos={(veiculos ?? []).map((v) => ({ placa: v.placa, marca: v.marca, modelo: v.modelo }))}
        motoristas={motoristas ?? []}
      />
    </div>
  );
}
