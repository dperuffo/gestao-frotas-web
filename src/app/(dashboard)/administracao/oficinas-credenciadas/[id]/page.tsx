import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { OficinaForm } from "../_components/OficinaForm";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

export default async function EditarOficinaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Esta tela é exclusiva do time interno (perfil administrador).</p>
      </div>
    );
  }

  const { data: oficina } = await supabase.from("oficinas_credenciadas").select("*").eq("id", id).single();

  if (!oficina) {
    notFound();
  }

  return (
    <div>
      <BotaoVoltar href="/administracao/oficinas-credenciadas" />
      <CabecalhoPagina titulo={`Editar: ${oficina.nome}`} />
      <OficinaForm oficina={oficina} />
    </div>
  );
}
