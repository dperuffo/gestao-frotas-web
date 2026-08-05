import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarMapaPermissoes, temAcesso } from "@/lib/permissoes";
import { listarAvisosDaMinhaEmpresaAcao } from "../../actions";
import { AvisoEmpresaForm } from "../../_components/AvisoEmpresaForm";
import { BotaoVoltar } from "../../../_components/BotaoVoltar";

// Fase edição (04/08/2026) — pedido do Daniel: "Usuario poder editar um
// aviso criado no painel". Mesmo padrão de administracao/central-avisos/[id]
// (form reaproveitado em modo edição), mas sem select por id dedicado: como
// listar_avisos_da_minha_empresa() já é escopada pela empresa própria do
// usuário (mesma RPC SECURITY DEFINER da lista), buscar o aviso dentro dessa
// lista e dar notFound() se não achar é o MESMO efeito de checar ownership
// no banco — não dá pra "adivinhar" um id de outra empresa e cair aqui.
export default async function EditarAvisoEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil === "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Use o painel de Administração</h1>
        <p className="mt-2 text-sm text-slate-500">
          Como admin, você edita avisos oficiais da plataforma em Administração → Central de Avisos.
        </p>
      </div>
    );
  }

  const mapaPermissoes = perfil ? await carregarMapaPermissoes(supabase, perfil) : new Map();
  if (!temAcesso(mapaPermissoes, "aba_central_avisos")) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Seu perfil não tem permissão para editar avisos. Fale com o administrador da sua conta.
        </p>
      </div>
    );
  }

  const avisos = await listarAvisosDaMinhaEmpresaAcao();
  const aviso = avisos.find((a) => a.id === id);
  if (!aviso) notFound();

  return (
    <div>
      <BotaoVoltar href="/central-avisos/gerenciar" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Editar: {aviso.titulo}</h1>
      </div>
      <AvisoEmpresaForm aviso={aviso} />
    </div>
  );
}
