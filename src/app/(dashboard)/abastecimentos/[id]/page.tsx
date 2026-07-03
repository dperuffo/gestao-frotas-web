import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AbastecimentoForm } from "../_components/AbastecimentoForm";
import { ExcluirAbastecimento } from "../_components/ExcluirAbastecimento";

export default async function EditarAbastecimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: abastecimento } = await supabase
    .from("profrotas_abastecimentos")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();
  if (!abastecimento) notFound();

  const { data: empresa } = abastecimento.empresa_id
    ? await supabase.from("empresas").select("nome").eq("id", abastecimento.empresa_id).maybeSingle()
    : { data: null };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Editar Abastecimento</h1>
        <ExcluirAbastecimento id={abastecimento.id} />
      </div>
      <AbastecimentoForm abastecimento={abastecimento} empresas={[]} nomeEmpresaAtual={empresa?.nome} />
    </div>
  );
}
