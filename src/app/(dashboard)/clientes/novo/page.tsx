import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ClienteForm } from "../_components/ClienteForm";

// 01/10/2026 — gestor de frota também cadastra empresas aqui: elas entram
// direto no Grupo Econômico dele (RPC criar_empresa_no_grupo, ver
// clientes/actions.ts). O aviso abaixo deixa claro em qual grupo.
export default async function NovoClientePage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const souAdmin = perfil === "admin";

  let grupoNome: string | null = null;
  if (!souAdmin) {
    const { data } = await supabase
      .from("grupos_economicos")
      .select("nome")
      .eq("ativo", true)
      .order("nome")
      .limit(2);
    grupoNome = data?.length === 1 ? data[0].nome : null;
  }

  return (
    <div>
      <CabecalhoPagina titulo="Novo Cliente" />
      {!souAdmin && (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          {grupoNome ? (
            <>
              A nova empresa será cadastrada no grupo econômico <strong>{grupoNome}</strong> e você terá acesso a ela
              automaticamente. Plano e status são definidos pela equipe FNI.
            </>
          ) : (
            <>A nova empresa será cadastrada no seu grupo econômico e você terá acesso a ela automaticamente.</>
          )}
        </div>
      )}
      <ClienteForm souAdmin={souAdmin} />
    </div>
  );
}
