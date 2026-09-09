import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
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
      <CabecalhoPagina titulo="Novo Pneu" />
      <PneuForm empresaId={empresaId} placas={placas} />
    </div>
  );
}
