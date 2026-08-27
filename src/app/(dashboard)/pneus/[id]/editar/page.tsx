import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PneuForm } from "../../_components/PneuForm";

export default async function EditarPneuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: pneu } = await supabase.from("pneus").select("*").eq("id", id).maybeSingle();

  if (!pneu) notFound();

  const { data: veiculos } = await supabase.rpc("veiculos_da_empresa", { p_empresa_id: pneu.empresa_id });
  const placas = (veiculos ?? []).map((v) => v.placa).filter((p): p is string => Boolean(p)).sort();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Editar Pneu</h1>
      </div>
      <PneuForm empresaId={pneu.empresa_id} pneu={pneu} placas={placas} />
    </div>
  );
}
