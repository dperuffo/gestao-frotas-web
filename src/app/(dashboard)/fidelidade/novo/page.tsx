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
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Novo Item do Catálogo</h1>
      <p className="mb-6 text-sm text-slate-500">
        Item ficará disponível pro motorista resgatar no app &quot;Estrada que Cuida&quot; assim que salvo.
      </p>
      <ItemCatalogoForm />
    </div>
  );
}
