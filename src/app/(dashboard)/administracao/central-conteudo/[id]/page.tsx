import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConteudoForm } from "../_components/ConteudoForm";

export default async function EditarConteudoPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: conteudo } = await supabase.from("conteudo_ajuda").select("*").eq("id", Number(id)).single();

  if (!conteudo) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Editar: {conteudo.titulo}</h1>
        <p className="mt-1 text-sm text-slate-500 font-mono">{conteudo.chave}</p>
      </div>
      <ConteudoForm conteudo={conteudo} />
    </div>
  );
}
