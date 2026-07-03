import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PLANO_LABEL, STATUS_EMPRESA_LABEL, type Plano, type StatusEmpresa } from "@/lib/constants";
import { buscarPrecosPlanos } from "@/lib/planosPrecos";

function formatarMoeda(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Painel interno de Assinaturas — exclusivo do time FNI (perfil admin), pra
// acompanhar a base de clientes por plano/status, MRR estimado e trials em
// risco de expirar sem converter. Mesmo padrão de checagem de acesso já
// usado em /inteligencia-rede (perfil_usuario_atual() como 2ª camada de
// defesa, já que RLS de `empresas` também restringe SELECT geral ao admin).
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

  const [{ data: empresas, error }, precos] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, nome, plano, status, trial_ends_at, stripe_customer_id, created_at")
      .order("created_at", { ascending: false }),
    // Preço real de cada plano, direto do Stripe (Edge Function
    // planos-precos) — usado só pra ESTIMAR o MRR nesta tela; a cobrança de
    // verdade continua 100% no Stripe via stripe-webhook.
    buscarPrecosPlanos(),
  ]);

  const lista = empresas ?? [];

  const porStatus = new Map<string, number>();
  let mrrCents = 0;
  const trialsEmRisco: typeof lista = [];

  for (const e of lista) {
    porStatus.set(e.status, (porStatus.get(e.status) ?? 0) + 1);
    if (e.status === "ativo") {
      mrrCents += precos?.[e.plano as Plano]?.unit_amount ?? 0;
    }
    if (e.status === "trial" && e.trial_ends_at) {
      const diasRestantes = Math.ceil((new Date(e.trial_ends_at).getTime() - Date.now()) / 86400000);
      if (diasRestantes <= 3) trialsEmRisco.push(e);
    }
  }

  const totalClientes = lista.length;
  const totalTrial = porStatus.get("trial") ?? 0;
  const totalAtivos = porStatus.get("ativo") ?? 0;
  const totalSuspensos = porStatus.get("suspenso") ?? 0;
  const totalCancelados = porStatus.get("cancelado") ?? 0;
  const taxaConversao = totalClientes > 0 ? Math.round((totalAtivos / totalClientes) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Assinaturas</h1>
        <p className="mt-1 text-sm text-slate-500">Visão geral de planos, status de cobrança e MRR estimado.</p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">Erro ao carregar empresas: {error.message}</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Indicador label="Total de clientes" valor={String(totalClientes)} />
        <Indicador label="Em trial" valor={String(totalTrial)} />
        <Indicador label="Ativos" valor={String(totalAtivos)} />
        <Indicador label="Suspensos" valor={String(totalSuspensos)} />
        <Indicador label="Cancelados" valor={String(totalCancelados)} />
        <Indicador label="MRR estimado" valor={formatarMoeda(mrrCents)} />
      </div>

      <div className="mb-6 card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Taxa de conversão (ativos / total)</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">{taxaConversao}%</p>
      </div>

      {trialsEmRisco.length > 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{trialsEmRisco.length}</strong> trial(s) expirando em até 3 dias sem plano contratado:{" "}
          {trialsEmRisco.map((e) => e.nome).join(", ")}.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial até</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Desde</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{e.nome}</td>
                <td className="px-4 py-3 text-slate-600">{PLANO_LABEL[e.plano as Plano] ?? e.plano}</td>
                <td className="px-4 py-3">
                  <span className={e.status === "ativo" ? "badge-ativo" : "badge-inativo"}>
                    {STATUS_EMPRESA_LABEL[e.status as StatusEmpresa] ?? e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {e.trial_ends_at ? new Date(e.trial_ends_at).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{e.stripe_customer_id ? "Conectado" : "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.created_at ? new Date(e.created_at).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/assinatura?empresa=${e.id}`} className="text-frota-600 hover:underline">
                    Ver assinatura
                  </Link>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
