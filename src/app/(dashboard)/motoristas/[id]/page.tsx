import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { MotoristaForm } from "../_components/MotoristaForm";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

export default async function EditarMotoristaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: motorista } = await supabase.from("motoristas").select("*").eq("id", id).maybeSingle();
  if (!motorista) notFound();

  const { data: centrosCusto } = await supabase.from("centros_custo").select("id, nome").order("nome");
  const { data: empresa } = await supabase
    .from("empresas")
    .select("nome")
    .eq("id", motorista.empresa_id)
    .maybeSingle();

  return (
    <div>
      <BotaoVoltar href="/motoristas" />
      <CabecalhoPagina titulo="Editar Motorista" />
      <MotoristaForm
        motorista={motorista}
        empresas={[]}
        centrosCusto={centrosCusto ?? []}
        nomeEmpresaAtual={empresa?.nome}
      />
    </div>
  );
}
