import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PneuForm } from "../_components/PneuForm";

export default async function NovoPneuPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaId } = await searchParams;
  if (!empresaId) redirect("/pneus");

  const supabase = await createClient();
  const { data: veiculos } = await supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaId });
  const placas = (veiculos ?? []).map((v) => v.placa).filter((p): p is string => Boolean(p)).sort();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Novo Pneu</h1>
      </div>
      <PneuForm empresaId={empresaId} placas={placas} />
    </div>
  );
}
