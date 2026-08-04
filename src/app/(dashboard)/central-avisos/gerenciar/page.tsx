import { createClient } from "@/lib/supabase/server";
import { carregarMapaPermissoes, temAcesso } from "@/lib/permissoes";
import { listarAvisosDaMinhaEmpresaAcao } from "../actions";
import { AvisoEmpresaForm } from "../_components/AvisoEmpresaForm";
import { ListaAvisosEmpresa } from "../_components/ListaAvisosEmpresa";

// Fase Central-Avisos-Por-Empresa (04/08/2026, pedido do Daniel) — ele
// liberou, como admin, a permissão "aba_central_avisos" pro perfil
// gestor_frota esperando que isso deixasse esse perfil criar avisos. Achado:
// Central de Avisos (/administracao/central-avisos) é uma ferramenta de
// BROADCAST DA PLATAFORMA (segmentos/planos/empresas vazios = todos os
// clientes) — perguntado a ele como resolver, escolheu "liberar, mas só pra
// própria empresa". Esta tela é essa versão: mesma permissão
// "aba_central_avisos" (reaproveitada, não é funcionalidade nova), mas
// sempre travada — no banco, dentro de criar_aviso_empresa() — a aparecer
// só pra colegas da própria empresa de quem cria. Admin usa
// /administracao/central-avisos (avisos oficiais, sem esse limite).
export default async function GerenciarAvisosEmpresaPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil === "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Use o painel de Administração</h1>
        <p className="mt-2 text-sm text-slate-500">
          Como admin, você cria avisos oficiais da plataforma em Administração → Central de Avisos.
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
          Seu perfil não tem permissão para criar avisos. Fale com o administrador da sua conta.
        </p>
      </div>
    );
  }

  const avisos = await listarAvisosDaMinhaEmpresaAcao();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Meus Avisos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Avisos publicados aqui aparecem só para os colegas da sua própria empresa (sino/drawer/banner) — diferente
          da Central de Avisos oficial da plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AvisoEmpresaForm />
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Publicados pela sua empresa</h2>
          <ListaAvisosEmpresa avisos={avisos} />
        </div>
      </div>
    </div>
  );
}
