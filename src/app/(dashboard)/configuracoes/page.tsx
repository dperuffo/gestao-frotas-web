import { createClient } from "@/lib/supabase/server";
import { buscarLogoutInatividadeMinutos } from "@/lib/configuracoesSistema";
import { FormularioLogoutInatividade } from "./_components/FormularioLogoutInatividade";

// Fase 27.86 — pedido do Daniel: "Implementar logout automatico por um
// período de inatividade do usuario no sistema. Parametrizavel em tela de
// configuração do admin". Nova tela /configuracoes — exclusiva do time FNI
// (perfil admin), mesmo padrão de checagem de acesso de /assinaturas e
// /inteligencia-rede (perfil_usuario_atual() como 2ª camada de defesa,
// além da RLS de configuracoes_sistema que já restringe UPDATE ao admin).
//
// Parâmetros configurados aqui são GLOBAIS — valem pro sistema inteiro
// (todos os clientes, postos e perfis), não por empresa — por isso não tem
// seletor de cliente/posto nesta tela.
export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela é exclusiva do time interno (perfil administrador). Fale com um administrador se você
          precisa ajustar essas configurações.
        </p>
      </div>
    );
  }

  const logoutInatividadeMinutos = await buscarLogoutInatividadeMinutos(supabase);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Configurações do Sistema</h1>
        <p className="mt-1 text-sm text-slate-500">
          Parâmetros globais da plataforma — valem para todos os clientes, postos e usuários.
        </p>
      </div>

      <FormularioLogoutInatividade minutosAtuais={logoutInatividadeMinutos} />
    </div>
  );
}
