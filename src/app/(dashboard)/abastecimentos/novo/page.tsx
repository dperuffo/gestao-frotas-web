import { createClient } from "@/lib/supabase/server";
import { AbastecimentoForm } from "../_components/AbastecimentoForm";

export default async function NovoAbastecimentoPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Lançar Abastecimento Manual</h1>
      <AbastecimentoForm empresas={empresas ?? []} />
    </div>
  );
}
