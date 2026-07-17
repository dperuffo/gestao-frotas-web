import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ItemCatalogoForm } from "../../_components/ItemCatalogoForm";

export default async function EditarItemCatalogoPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: item } = await supabase
    .from("fidelidade_catalogo_itens")
    .select("id, categoria, titulo, descricao, parceiro_nome, pontos_necessarios, ativo")
    .eq("id", id)
    .maybeSingle();

  if (!item) notFound();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Editar Item do Catálogo</h1>
      <p className="mb-6 text-sm text-slate-500">{item.titulo}</p>
      <ItemCatalogoForm item={item} />
    </div>
  );
}
