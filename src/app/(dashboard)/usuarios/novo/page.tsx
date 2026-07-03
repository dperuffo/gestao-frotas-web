import { createClient } from "@/lib/supabase/server";
import { UsuarioForm } from "../_components/UsuarioForm";

export default async function NovoUsuarioPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Usuário</h1>
      <UsuarioForm empresas={empresas ?? []} />
    </div>
  );
}
