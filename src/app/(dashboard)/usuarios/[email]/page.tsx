import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsuarioForm } from "../_components/UsuarioForm";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: emailCodificado } = await params;
  const email = decodeURIComponent(emailCodificado);
  const supabase = await createClient();

  // Achado real (26/07/2026) — este era o 404 reportado pelo Daniel: um
  // perfil não-admin/analista conseguia CRIAR outro usuário (Server Action
  // usava cliente admin, sem checar quem chamava — já corrigido em
  // ../actions.ts), mas a RLS de SELECT em usuarios_app só deixa
  // admin/analista verem outros usuários — então o redirect pós-criação
  // caía aqui, a query abaixo voltava vazia, e `notFound()` virava uma
  // página 404 sem explicação nenhuma. Guarda explícita aqui pra mostrar o
  // motivo de verdade em vez de um 404 misterioso.
  const { data: perfilAtual } = await supabase.rpc("perfil_usuario_atual");
  if (perfilAtual !== "admin" && perfilAtual !== "analista") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela é exclusiva do time interno (perfil administrador ou analista).
        </p>
      </div>
    );
  }

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
      <BotaoVoltar href="/usuarios" />
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Editar Usuário — {usuario.nome}</h1>
      <UsuarioForm usuario={usuario} empresas={[]} empresaAtualId={vinculo?.empresa_id} />
    </div>
  );
}
