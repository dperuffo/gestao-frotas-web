import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NovoGrupoForm } from "../_components/NovoGrupoForm";

// Fase Grupo-Economico-Frota-Billing (09/08/2026) — pedido do Daniel: "Grupo
// Econômico deveria ser permitido pela aplicação para cadastro e
// visualização" pelo próprio cliente, não só pelo admin. Espelha
// /rede-postos/novo/page.tsx (Fase 27.139) tal e qual, só trocando
// segmento='Revenda' por 'Frota': sempre pede a empresa fundadora aqui —
// pro self-service isso já resolve o problema de "grupo órfão sem membro"
// (ver criarGrupoFrotaSelfService em gruposEconomicos.ts); pro admin,
// mostra todas as empresas Frota pra escolher qualquer uma como fundadora.
export default async function NovoGrupoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const ehAdmin = perfil === "admin" || user?.email === "d.peruffo@gmail.com";

  let empresasOpcoes: { id: string; nome: string }[] = [];
  if (ehAdmin) {
    const { data } = await supabase.from("empresas").select("id, nome").eq("segmento", "Frota").order("nome");
    empresasOpcoes = data ?? [];
  } else {
    const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
    if (minhasEmpresasIds && minhasEmpresasIds.length > 0) {
      const { data } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("segmento", "Frota")
        .in("id", minhasEmpresasIds)
        .order("nome");
      empresasOpcoes = data ?? [];
    }
  }

  if (!ehAdmin && empresasOpcoes.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Grupo Econômico</h1>
        <div className="card p-6 text-sm text-slate-600">
          Você precisa ter uma empresa cadastrada antes de criar um Grupo Econômico.{" "}
          <Link href="/minha-empresa" className="font-medium text-frota-600 hover:underline">
            Cadastre sua empresa em &quot;Minha Empresa&quot;
          </Link>{" "}
          e volte aqui em seguida.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Novo Grupo Econômico</h1>
      <NovoGrupoForm empresasOpcoes={empresasOpcoes} />
    </div>
  );
}
