import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RedeForm } from "../_components/RedeForm";
import { VincularPostoForm } from "../_components/VincularPostoForm";

// Fase 27.87 — espelha /grupo-economico/[id]/page.tsx, filtrado a
// segmento='Revenda' (postos revendedores).
export default async function EditarRedePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rede } = await supabase.from("grupos_economicos").select("*").eq("id", id).single();
  // A mesma tabela também guarda Grupo Econômico (segmento='Frota'); se
  // alguém abrir aqui o id de um Grupo (link direto, favorito antigo
  // etc.), trata como não encontrado nesta tela — o lugar certo é
  // /grupo-economico/[id].
  if (!rede || rede.segmento !== "Revenda") notFound();

  const { data: vinculosRaw } = await supabase
    .from("grupos_economicos_empresas")
    .select("id, empresa:empresas(id, nome)")
    .eq("grupo_economico_id", id);

  const vinculos = (vinculosRaw ?? []).map((v) => ({
    id: v.id,
    empresa: v.empresa as unknown as { id: string; nome: string } | null,
  }));

  const idsVinculados = new Set(vinculos.map((v) => v.empresa?.id).filter(Boolean));

  const { data: todosPostos } = await supabase
    .from("empresas")
    .select("id, nome")
    .eq("segmento", "Revenda")
    .order("nome");
  const postosDisponiveis = (todosPostos ?? []).filter((p) => !idsVinculados.has(p.id));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Editar Rede de Postos — {rede.nome}</h1>
      <RedeForm rede={rede} />
      <VincularPostoForm redeId={id} postosDisponiveis={postosDisponiveis} vinculos={vinculos} />
    </div>
  );
}
