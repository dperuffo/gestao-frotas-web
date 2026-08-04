import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RedeForm } from "../_components/RedeForm";
import { VincularPostoForm } from "../_components/VincularPostoForm";
import { BotaoVoltar } from "../../_components/BotaoVoltar";

// Fase 27.87 — espelha /grupo-economico/[id]/page.tsx, filtrado a
// segmento='Revenda' (postos revendedores).
//
// Fase 27.139 — pedido do Daniel: "Rede de Posto tem que estar na visão do
// posto para criação e gestão". A RLS de grupos_economicos (grupos_select)
// já garante que só quem é membro da Rede (ou admin) enxerga esta página —
// quem não é, cai no notFound() abaixo. A lista de "postos disponíveis pra
// vincular" agora também é restrita: um posto self-service só pode vincular
// postos que ele mesmo controla (mesma regra da RLS gee_insere) — antes
// mostrava TODOS os postos Revenda da base, o que vazava nome de posto de
// outra empresa pra qualquer usuário que abrisse esta tela.
export default async function EditarRedePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rede } = await supabase.from("grupos_economicos").select("*").eq("id", id).single();
  // A mesma tabela também guarda Grupo Econômico (segmento='Frota'); se
  // alguém abrir aqui o id de um Grupo (link direto, favorito antigo
  // etc.), trata como não encontrado nesta tela — o lugar certo é
  // /grupo-economico/[id].
  if (!rede || rede.segmento !== "Revenda") notFound();

  const { data: vinculosRaw } = await supabase
    .from("grupos_economicos_empresas")
    .select("id, empresa:empresas(id, nome)")
    .eq("grupo_economico_id", id);

  const vinculos = (vinculosRaw ?? []).map((v) => ({
    id: v.id,
    empresa: v.empresa as unknown as { id: string; nome: string } | null,
  }));

  const idsVinculados = new Set(vinculos.map((v) => v.empresa?.id).filter(Boolean));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const ehAdmin = perfil === "admin" || user?.email === "d.peruffo@gmail.com";

  let todosPostos: { id: string; nome: string }[] = [];
  if (ehAdmin) {
    const { data } = await supabase.from("empresas").select("id, nome").eq("segmento", "Revenda").order("nome");
    todosPostos = data ?? [];
  } else {
    const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });
    if (minhasEmpresasIds && minhasEmpresasIds.length > 0) {
      const { data } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("segmento", "Revenda")
        .in("id", minhasEmpresasIds)
        .order("nome");
      todosPostos = data ?? [];
    }
  }
  const postosDisponiveis = todosPostos.filter((p) => !idsVinculados.has(p.id));

  return (
    <div className="space-y-6">
      <BotaoVoltar href="/rede-postos" />
      <h1 className="text-xl font-semibold text-slate-900">Editar Rede de Postos — {rede.nome}</h1>
      <RedeForm rede={rede} />
      <VincularPostoForm redeId={id} postosDisponiveis={postosDisponiveis} vinculos={vinculos} />
    </div>
  );
}
