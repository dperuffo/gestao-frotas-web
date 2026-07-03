import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsuarioForm } from "../_components/UsuarioForm";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: emailCodificado } = await params;
  const email = decodeURIComponent(emailCodificado);
  const supabase = await createClient();

  const { data: usuario } = await supabase.from("usuarios_app").select("*").eq("email", email).single();
  if (!usuario) notFound();

  const { data: vinculo } = await supabase
    .from("usuarios_empresas")
    .select("empresa_id")
    .eq("user_email", email)
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Usuário — {usuario.nome}</h1>
      <UsuarioForm usuario={usuario} empresas={[]} empresaAtualId={vinculo?.empresa_id} />
    </div>
  );
}
