import { createClient } from "@/lib/supabase/server";
import { PostoForm } from "../_components/PostoForm";

export default async function NovoPostoPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Posto Revendedor</h1>
      <PostoForm empresas={empresas ?? []} />
    </div>
  );
}
