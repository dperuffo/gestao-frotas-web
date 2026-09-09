import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { MotoristaForm } from "../_components/MotoristaForm";

export default async function NovoMotoristaPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");
  const { data: centrosCusto } = await supabase.from("centros_custo").select("id, nome").order("nome");

  return (
    <div>
      <CabecalhoPagina titulo="Novo Motorista" />
      <MotoristaForm empresas={empresas ?? []} centrosCusto={centrosCusto ?? []} />
    </div>
  );
}
