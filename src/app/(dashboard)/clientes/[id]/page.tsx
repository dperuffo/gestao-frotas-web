import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteForm } from "../_components/ClienteForm";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cliente } = await supabase.from("empresas").select("*").eq("id", id).single();

  if (!cliente) notFound();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Cliente — {cliente.nome}</h1>
      <ClienteForm cliente={cliente} />
    </div>
  );
}
