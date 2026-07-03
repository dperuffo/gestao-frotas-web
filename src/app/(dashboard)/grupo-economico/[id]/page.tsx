import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GrupoForm } from "../_components/GrupoForm";
import { VincularEmpresaForm } from "../_components/VincularEmpresaForm";

export default async function EditarGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: grupo } = await supabase.from("grupos_economicos").select("*").eq("id", id).single();
  if (!grupo) notFound();

  const { data: vinculosRaw } = await supabase
    .from("grupos_economicos_empresas")
    .select("id, empresa:empresas(id, nome)")
    .eq("grupo_economico_id", id);

  const vinculos = (vinculosRaw ?? []).map((v) => ({
    id: v.id,
    empresa: v.empresa as unknown as { id: string; nome: string } | null,
  }));

  const idsVinculados = new Set(vinculos.map((v) => v.empresa?.id).filter(Boolean));

  const { data: todasEmpresas } = await supabase.from("empresas").select("id, nome").order("nome");
  const empresasDisponiveis = (todasEmpresas ?? []).filter((e) => !idsVinculados.has(e.id));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Editar Grupo Econômico — {grupo.nome}</h1>
      <GrupoForm grupo={grupo} />
      <VincularEmpresaForm grupoId={id} empresasDisponiveis={empresasDisponiveis} vinculos={vinculos} />
    </div>
  );
}
