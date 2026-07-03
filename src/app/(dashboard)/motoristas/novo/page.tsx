import { createClient } from "@/lib/supabase/server";
import { MotoristaForm } from "../_components/MotoristaForm";

export default async function NovoMotoristaPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");
  const { data: centrosCusto } = await supabase.from("centros_custo").select("id, nome").order("nome");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Motorista</h1>
      <MotoristaForm empresas={empresas ?? []} centrosCusto={centrosCusto ?? []} />
    </div>
  );
}
