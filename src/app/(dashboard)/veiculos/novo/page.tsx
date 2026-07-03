import { createClient } from "@/lib/supabase/server";
import { VeiculoForm } from "../_components/VeiculoForm";

export default async function NovoVeiculoPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");
  const { data: centrosCusto } = await supabase.from("centros_custo").select("id, nome").order("nome");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Veículo</h1>
      <VeiculoForm empresas={empresas ?? []} centrosCusto={centrosCusto ?? []} />
    </div>
  );
}
