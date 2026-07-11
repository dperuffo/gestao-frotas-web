import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NovaRedeForm } from "../_components/NovaRedeForm";

// Fase 27.139 — pedido do Daniel: "Rede de Posto tem que estar na visão do
// posto para criação e gestão". Antes esta tela só existia pra admin criar
// uma Rede vazia (sem posto nenhum) e depois vincular postos na tela
// seguinte. Agora sempre pede o posto fundador aqui — pro posto self-service
// isso já resolve o problema de "Rede órfã sem membro" (ver
// criarRedePostoSelfService em gruposEconomicos.ts); pro admin, mostra
// todos os postos Revenda pra escolher qualquer um como fundador.
export default async function NovaRedePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const ehAdmin = perfil === "admin" || user?.email === "d.peruffo@gmail.com";

  let postosOpcoes: { id: string; nome: string }[] = [];
  if (ehAdmin) {
    const { data } = await supabase.from("empresas").select("id, nome").eq("segmento", "Revenda").order("nome");
    postosOpcoes = data ?? [];
  } else {
    const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
    if (minhasEmpresasIds && minhasEmpresasIds.length > 0) {
      const { data } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("segmento", "Revenda")
        .in("id", minhasEmpresasIds)
        .order("nome");
      postosOpcoes = data ?? [];
    }
  }

  if (!ehAdmin && postosOpcoes.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Nova Rede de Postos</h1>
        <div className="card p-6 text-sm text-slate-600">
          Você precisa ter um posto cadastrado antes de criar uma Rede de Postos.{" "}
          <Link href="/meu-posto" className="font-medium text-frota-600 hover:underline">
            Cadastre seu posto em &quot;Meu Posto&quot;
          </Link>{" "}
          e volte aqui em seguida.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Nova Rede de Postos</h1>
      <NovaRedeForm postosOpcoes={postosOpcoes} />
    </div>
  );
}
