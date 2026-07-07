import { createClient } from "@/lib/supabase/server";
import { IndicadoresFinanceirosFni } from "../_components/IndicadoresFinanceirosFni";

// Painel interno de Assinaturas — exclusivo do time FNI (perfil admin), pra
// acompanhar a base de clientes por plano/status, MRR estimado, faturamento
// e churn. Mesmo padrão de checagem de acesso já usado em /inteligencia-rede
// (perfil_usuario_atual() como 2ª camada de defesa, já que RLS de `empresas`
// também restringe SELECT geral ao admin).
//
// Fase 27.78 — o conteúdo em si foi extraído pra IndicadoresFinanceirosFni.tsx
// (componente compartilhado), porque /financeiro (Painel Financeiro, item de
// menu que o admin efetivamente usa) passou a mostrar a MESMA coisa quando
// nenhum cliente específico está selecionado — ver financeiro/page.tsx e o
// achado real documentado lá. Esta página continua existindo como link
// direto (e pra quem já tem o hábito de acessar por aqui).
export default async function AssinaturasAdminPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela é exclusiva do time interno (perfil administrador). Fale com um administrador se você
          precisa desses dados.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Assinaturas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Indicadores financeiros da FNI — planos, cobrança e MRR (não é o painel de custo do cliente, que
          fica em Painel Financeiro).
        </p>
      </div>
      <IndicadoresFinanceirosFni />
    </div>
  );
}
