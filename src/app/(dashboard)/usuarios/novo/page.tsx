import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { UsuarioForm } from "../_components/UsuarioForm";

export default async function NovoUsuarioPage() {
  const supabase = await createClient();

  // Achado real de segurança (26/07/2026) — ver mesma guarda em
  // ../page.tsx e em ../actions.ts (criarUsuario já rejeita a escrita;
  // isto aqui só evita mostrar o formulário de convite pra quem nem
  // deveria estar nesta tela).
  const { data: perfilAtual } = await supabase.rpc("perfil_usuario_atual");
  if (perfilAtual !== "admin" && perfilAtual !== "analista") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Esta tela é exclusiva do time interno (perfil administrador ou analista).
        </p>
      </div>
    );
  }

  const { data: empresas } = await supabase.from("empresas").select("id, nome").order("nome");

  return (
    <div>
      <CabecalhoPagina titulo="Novo Usuário" />
      <UsuarioForm empresas={empresas ?? []} />
    </div>
  );
}
