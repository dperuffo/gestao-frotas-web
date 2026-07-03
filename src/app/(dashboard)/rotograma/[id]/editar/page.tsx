import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RotogramaForm } from "../../_components/RotogramaForm";

export default async function EditarRotogramaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rotograma } = await supabase.from("rotogramas").select("*").eq("id", id).maybeSingle();
  if (!rotograma) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome")
    .eq("id", rotograma.empresa_id ?? "")
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Rotograma #{rotograma.numero}</h1>
      <RotogramaForm rotograma={rotograma} empresas={[]} rotasSalvas={[]} nomeEmpresaAtual={empresa?.nome} />
    </div>
  );
}
