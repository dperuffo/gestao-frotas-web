import type { SupabaseClient } from "@supabase/supabase-js";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatarTokens } from "@/lib/assistenteConsumo";
import { LinhaLimite } from "./_components/LinhaLimite";
import { salvarLimiteClienteAcao, salvarLimitePlanoAcao } from "./actions";
import { perfilDoUsuarioAtual } from "@/lib/dadosUsuarioCache";

// Limites de tokens do Assistente FNI por plano e por cliente — tela exclusiva do time
// interno (perfil admin), mesmo padrão de /administracao/pisos-antt.
const ROTULO_PLANO: Record<string, string> = {
  gratuito: "Gratuito",
  basico: "Básico",
  profissional: "Profissional",
  enterprise: "Enterprise",
  posto_essencial: "Posto Essencial",
  posto_profissional: "Posto Profissional",
  posto_enterprise: "Posto Enterprise",
};
const ORDEM = Object.keys(ROTULO_PLANO);

export default async function LimitesAssistentePage() {
  const supabase = await createClient();
  const perfil = await perfilDoUsuarioAtual(supabase);
  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Esta tela é exclusiva do time interno (perfil administrador).</p>
      </div>
    );
  }

  const admin = createAdminClient() as unknown as SupabaseClient;
  const [{ data: planosBrutos }, { data: excecoes }, { data: consumo }] = await Promise.all([
    admin.from("limites_plano").select("plano, assistente_tokens_mes"),
    admin.from("assistente_config_empresa").select("empresa_id, franquia_tokens_mes"),
    supabase.rpc("assistente_consumo_por_empresa_mes"),
  ]);

  const planos = ((planosBrutos ?? []) as { plano: string; assistente_tokens_mes: number }[]).sort(
    (a, b) => (ORDEM.indexOf(a.plano) + 1 || 99) - (ORDEM.indexOf(b.plano) + 1 || 99)
  );
  const excecaoPorEmpresa = new Map(
    ((excecoes ?? []) as { empresa_id: string; franquia_tokens_mes: number | null }[]).map((e) => [e.empresa_id, e.franquia_tokens_mes])
  );
  const clientes = [...(consumo ?? [])].sort((a, b) => Number(b.tokens) - Number(a.tokens));

  return (
    <div>
      <CabecalhoPagina
        titulo="Limites do Assistente FNI"
        descricao="Franquia mensal de tokens da IA por plano e exceções por cliente. Clientes com chave própria da Anthropic não usam a franquia. Use -1 para ilimitado."
      />

      <section className="card mb-6 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Por plano</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Vale para todos os clientes do plano, a partir da próxima pergunta. O consumo do mês corrente é mantido.
        </p>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-1 pr-3">Plano</th>
              <th className="py-1 pr-3">Limite atual</th>
              <th className="py-1">Novo limite (tokens/mês)</th>
            </tr>
          </thead>
          <tbody>
            {planos.map((p) => (
              <tr key={p.plano} className="border-t border-slate-100 dark:border-slate-700">
                <td className="py-2 pr-3 font-medium">{ROTULO_PLANO[p.plano] ?? p.plano}</td>
                <td className="py-2 pr-3 tabular-nums">{p.assistente_tokens_mes < 0 ? "ilimitado" : formatarTokens(p.assistente_tokens_mes)}</td>
                <td className="py-2">
                  <LinhaLimite
                    valorInicial={p.assistente_tokens_mes}
                    onSalvar={async (v) => {
                      "use server";
                      return salvarLimitePlanoAcao(p.plano, v ?? 0);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Por cliente (exceção) e consumo do mês</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Deixe a exceção em branco para o cliente usar o limite do plano. Ordenado pelo maior consumo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-1 pr-3">Cliente</th>
                <th className="py-1 pr-3">Plano</th>
                <th className="py-1 pr-3 text-right">Consumo</th>
                <th className="py-1 pr-3 text-right">Limite efetivo</th>
                <th className="py-1 pr-3">Chave</th>
                <th className="py-1">Exceção (tokens/mês)</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.empresa_id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-2 pr-3">{c.empresa_nome}</td>
                  <td className="py-2 pr-3">{ROTULO_PLANO[c.plano] ?? c.plano}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatarTokens(Number(c.tokens))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{Number(c.franquia) < 0 ? "ilimitado" : formatarTokens(Number(c.franquia))}</td>
                  <td className="py-2 pr-3">{c.chave_propria ? "própria" : "FNI"}</td>
                  <td className="py-2">
                    <LinhaLimite
                      valorInicial={excecaoPorEmpresa.get(c.empresa_id) ?? null}
                      permitirVazio
                      placeholder="usa o plano"
                      onSalvar={async (v) => {
                        "use server";
                        return salvarLimiteClienteAcao(c.empresa_id, v);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
