import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MotoristaForm } from "../_components/MotoristaForm";

export default async function EditarMotoristaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: motorista } = await supabase.from("motoristas").select("*").eq("id", id).maybeSingle();
  if (!motorista) notFound();

  const { data: centrosCusto } = await supabase.from("centros_custo").select("id, nome").order("nome");
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome")
    .eq("id", motorista.empresa_id)
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Motorista</h1>
      <MotoristaForm
        motorista={motorista}
        empresas={[]}
        centrosCusto={centrosCusto ?? []}
        nomeEmpresaAtual={empresa?.nome}
      />
    </div>
  );
}
