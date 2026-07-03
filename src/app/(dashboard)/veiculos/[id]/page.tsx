import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCNPJ } from "@/lib/utils";
import { VeiculoForm } from "../_components/VeiculoForm";

export default async function EditarVeiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: veiculo } = await supabase.from("cadastro_veiculos").select("*").eq("id", id).maybeSingle();
  if (!veiculo) notFound();

  const { data: centrosCusto } = await supabase.from("centros_custo").select("id, nome").order("nome");

  // cadastro_veiculos não tem empresa_id (só cnpj_frota), então achamos o nome
  // do cliente comparando o CNPJ normalizado (ignora pontuação e maiúsc/minúsc).
  const { data: empresas } = await supabase.from("empresas").select("nome, cnpj");
  const empresaAtual = empresas?.find((e) => normalizarCNPJ(e.cnpj) === normalizarCNPJ(veiculo.cnpj_frota));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Veículo</h1>
      <VeiculoForm
        veiculo={veiculo}
        empresas={[]}
        centrosCusto={centrosCusto ?? []}
        nomeEmpresaAtual={empresaAtual?.nome ?? undefined}
      />
    </div>
  );
}
