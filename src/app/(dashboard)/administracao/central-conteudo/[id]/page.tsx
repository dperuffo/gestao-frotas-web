import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ConteudoForm } from "../_components/ConteudoForm";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

export default async function EditarConteudoPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: conteudo } = await supabase.from("conteudo_ajuda").select("*").eq("id", Number(id)).single();

  if (!conteudo) {
    notFound();
  }

  return (
    <div>
      <BotaoVoltar href="/administracao/central-conteudo" />
      <CabecalhoPagina titulo={`Editar: ${conteudo.titulo}`} descricao={<span className="font-mono">{conteudo.chave}</span>} />
      <ConteudoForm conteudo={conteudo} />
    </div>
  );
}
