import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { VeiculoForm } from "../_components/VeiculoForm";

export default async function NovoVeiculoPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");
  const { data: centrosCusto } = await supabase.from("centros_custo").select("id, nome").order("nome");

  return (
    <div>
      <CabecalhoPagina titulo="Novo Veículo" />
      <VeiculoForm empresas={empresas ?? []} centrosCusto={centrosCusto ?? []} />
    </div>
  );
}
