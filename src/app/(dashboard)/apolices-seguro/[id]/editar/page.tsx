import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApoliceForm } from "../../_components/ApoliceForm";

export default async function EditarApolicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: apolice } = await supabase.from("apolices_seguro").select("*").eq("id", id).maybeSingle();

  if (!apolice) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Editar Apólice</h1>
      </div>
      <ApoliceForm empresaId={apolice.empresa_id} apolice={apolice} />
    </div>
  );
}
