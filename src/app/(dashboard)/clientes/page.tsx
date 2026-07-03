import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_EMPRESA_LABEL, type StatusEmpresa } from "@/lib/constants";
import { formatCNPJ } from "@/lib/utils";
import { ToggleAtivoCliente } from "./_components/ToggleAtivoCliente";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { marcarAcessosClientesVistosAcao } from "./actions";

function badgeClasse(status: string) {
  if (status === "ativo" || status === "trial") return "badge-ativo";
  if (status === "suspenso") return "badge-atencao";
  return "badge-inativo";
}

// Data + hora (não só data, como formatDate) — pra distinguir logins no
// mesmo dia no painel "Últimos acessos".
function formatDataHora(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const ehAdmin = perfil === "admin";

  let query = supabase
    .from("empresas")
    .select("id, nome, cnpj, status, porte, segmento_transporte, uf, plano, max_veiculos")
    .order("nome");

  if (q) {
    query = query.or(`nome.ilike.%${q}%,cnpj.ilike.%${q}%`);
  }

  const { data: clientes, error } = await query;

  const { count: totalAtivos } = await supabase
    .from("empresas")
    .select("id", { count: "exact", head: true })
    .eq("status", "ativo");

  const { count: totalGeral } = await supabase
    .from("empresas")
    .select("id", { count: "exact", head: true });

  // Últimos acessos de clientes à plataforma (Fase 27.20) — admin-only,
  // mesma lógica de "marcar como visto ao abrir a página" já usada em
  // chamados/[id]/page.tsx, só que centralizada na action pra também zerar
  // o badge do menu de uma vez.
  let ultimosAcessos: { id: string; user_email: string; criado_em: string; empresas: { nome: string } | null }[] = [];
  if (ehAdmin) {
    const [{ data: acessos }] = await Promise.all([
      supabase
        .from("acessos_clientes")
        .select("id, user_email, criado_em, empresas(nome)")
        .order("criado_em", { ascending: false })
        .limit(20),
      marcarAcessosClientesVistosAcao(),
    ]);
    ultimosAcessos = acessos ?? [];
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Clientes <AjudaIcon chave="clientes.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastro das empresas (transportadoras) atendidas pela plataforma.
          </p>
        </div>
        <Link href="/clientes/novo" className="btn-primary">
          + Novo Cliente
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador label="Total de clientes" valor={totalGeral ?? 0} />
        <Indicador label="Ativos" valor={totalAtivos ?? 0} />
        <Indicador label="Outros status" valor={(totalGeral ?? 0) - (totalAtivos ?? 0)} />
      </div>

      <form className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por Razão Social ou CNPJ..."
          className="input max-w-sm"
        />
      </form>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar clientes: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Razão Social</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">UF</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientes?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${c.id}`} className="font-medium text-frota-600 hover:underline">
                    {c.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatCNPJ(c.cnpj)}</td>
                <td className="px-4 py-3 text-slate-600">{c.uf ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.segmento_transporte ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.plano}</td>
                <td className="px-4 py-3">
                  <span className={badgeClasse(c.status)}>
                    {STATUS_EMPRESA_LABEL[c.status as StatusEmpresa] ?? c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ToggleAtivoCliente id={c.id} ativo={c.status === "ativo"} />
                </td>
              </tr>
            ))}
            {clientes?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {ehAdmin && (
        <div className="card mt-6 overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Últimos acessos</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Logins recentes de clientes na plataforma, inclusive em período trial/gratuito.
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Data/hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ultimosAcessos.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{a.empresas?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{a.user_email}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDataHora(a.criado_em)}</td>
                </tr>
              ))}
              {ultimosAcessos.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                    Nenhum acesso registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Indicador({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
