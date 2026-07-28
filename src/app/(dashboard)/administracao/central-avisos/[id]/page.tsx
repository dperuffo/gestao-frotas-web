import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvisoForm } from "../_components/AvisoForm";

export default async function EditarAvisoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">Esta tela é exclusiva do time interno (perfil administrador).</p>
      </div>
    );
  }

  const { data: aviso } = await supabase.from("comunicados").select("*").eq("id", id).single();

  if (!aviso) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Editar: {aviso.titulo}</h1>
      </div>
      <AvisoForm aviso={aviso} />
    </div>
  );
}
