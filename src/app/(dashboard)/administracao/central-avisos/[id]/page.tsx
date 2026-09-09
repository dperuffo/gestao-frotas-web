import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { AvisoForm } from "../_components/AvisoForm";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

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
      <BotaoVoltar href="/administracao/central-avisos" />
      <CabecalhoPagina titulo={`Editar: ${aviso.titulo}`} />
      <AvisoForm aviso={aviso} />
    </div>
  );
}
