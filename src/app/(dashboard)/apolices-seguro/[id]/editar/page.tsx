import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ApoliceForm } from "../../_components/ApoliceForm";

export default async function EditarApolicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: apolice } = await supabase.from("apolices_seguro").select("*").eq("id", id).maybeSingle();

  if (!apolice) notFound();

  return (
    <div>
      <CabecalhoPagina titulo="Editar Apólice" />
      <ApoliceForm empresaId={apolice.empresa_id} apolice={apolice} />
    </div>
  );
}
