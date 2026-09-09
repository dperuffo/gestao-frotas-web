import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
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
      <CabecalhoPagina titulo={`Editar Rotograma #${rotograma.numero}`} />
      <RotogramaForm rotograma={rotograma} empresas={[]} rotasSalvas={[]} nomeEmpresaAtual={empresa?.nome} />
    </div>
  );
}
