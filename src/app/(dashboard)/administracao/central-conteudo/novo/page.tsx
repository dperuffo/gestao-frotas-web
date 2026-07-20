import { createClient } from "@/lib/supabase/server";
import { ConteudoForm } from "../_components/ConteudoForm";

export default async function NovoConteudoPage() {
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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Nova entrada de conteúdo</h1>
        <p className="mt-1 text-sm text-slate-500">Ajuda contextual ou lição da Central de Treinamento.</p>
      </div>
      <ConteudoForm />
    </div>
  );
}
