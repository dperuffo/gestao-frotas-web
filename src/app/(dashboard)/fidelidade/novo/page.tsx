import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ItemCatalogoForm } from "../_components/ItemCatalogoForm";

export default async function NovoItemCatalogoPage() {
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

  return (
    <div>
      <CabecalhoPagina
        titulo="Novo Item do Catálogo"
        descricao={'Item ficará disponível pro motorista resgatar no app "Estrada que Cuida" assim que salvo.'}
      />
      <ItemCatalogoForm />
    </div>
  );
}
