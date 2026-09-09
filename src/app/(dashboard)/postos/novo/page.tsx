import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { PostoForm } from "../_components/PostoForm";

export default async function NovoPostoPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");

  return (
    <div>
      <CabecalhoPagina titulo="Novo Posto Revendedor" />
      <PostoForm empresas={empresas ?? []} />
    </div>
  );
}
