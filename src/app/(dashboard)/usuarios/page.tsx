import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PERFIL_LABEL, type Perfil } from "@/lib/constants";
import { ToggleAtivoUsuario } from "./_components/ToggleAtivoUsuario";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { BotaoExportarTabela } from "@/components/exportar/BotaoExportarTabela";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("usuarios_app")
    .select("email, nome, perfil, segmento, ativo, mfa_habilitado")
    .order("nome");

  if (q) {
    query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: usuarios, error } = await query;

  // usuarios_empresas e empresas não têm FK direta para usuarios_app (o vínculo é por e-mail),
  // então buscamos à parte e cruzamos em memória para mostrar "Cliente(s)" na grid.
  const { data: vinculos } = await supabase.from("usuarios_empresas").select("user_email, empresa_id");
  const { data: empresas } = await supabase.from("empresas").select("id, nome");
  const nomeEmpresaPorId = new Map((empresas ?? []).map((e) => [e.id, e.nome]));
  const empresasPorEmail = new Map<string, string[]>();
  for (const v of vinculos ?? []) {
    const nome = nomeEmpresaPorId.get(v.empresa_id) ?? v.empresa_id;
    const lista = empresasPorEmail.get(v.user_email) ?? [];
    lista.push(nome);
    empresasPorEmail.set(v.user_email, lista);
  }

  const totalUsuarios = usuarios?.length ?? 0;
  const totalAtivos = usuarios?.filter((u) => u.ativo).length ?? 0;
  const totalMfa = usuarios?.filter((u) => u.mfa_habilitado).length ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Usuários <AjudaIcon chave="usuarios.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Usuários com acesso à plataforma, seus perfis e vínculos com clientes.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/usuarios/importar" className="btn-secondary">
            Importar planilha
          </Link>
          <Link href="/usuarios/novo" className="btn-primary">
            + Novo Usuário
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador label="Total de usuários" valor={totalUsuarios} />
        <Indicador label="Ativos" valor={totalAtivos} />
        <Indicador label="Com MFA habilitado" valor={totalMfa} />
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <form>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nome ou e-mail..."
            className="input max-w-sm"
          />
        </form>
        <BotaoExportarTabela
          nomeArquivo="usuarios"
          titulo="Usuários"
          colunas={[
            { header: "Nome", chave: "nome" },
            { header: "E-mail", chave: "email" },
            { header: "Perfil", chave: "perfil" },
            { header: "Segmento", chave: "segmento" },
            { header: "Cliente(s)", chave: "clientes" },
            { header: "MFA", chave: "mfa" },
            { header: "Status", chave: "status" },
          ]}
          linhas={(usuarios ?? []).map((u) => ({
            nome: u.nome ?? "(sem nome)",
            email: u.email,
            perfil: PERFIL_LABEL[u.perfil as Perfil] ?? u.perfil,
            segmento: u.segmento ?? "—",
            clientes: (empresasPorEmail.get(u.email) ?? []).join(", ") || "—",
            mfa: u.mfa_habilitado ? "Habilitado" : "Pendente",
            status: u.ativo ? "Ativo" : "Inativo",
          }))}
        />
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar usuários: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3">Cliente(s)</th>
              <th className="px-4 py-3">MFA</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios?.map((u) => (
              <tr key={u.email} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/usuarios/${encodeURIComponent(u.email)}`} className="font-medium text-frota-600 hover:underline">
                    {u.nome ?? "(sem nome)"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3 text-slate-600">{PERFIL_LABEL[u.perfil as Perfil] ?? u.perfil}</td>
                <td className="px-4 py-3 text-slate-600">{u.segmento ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(empresasPorEmail.get(u.email) ?? []).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={u.mfa_habilitado ? "badge-ativo" : "badge-atencao"}>
                    {u.mfa_habilitado ? "Habilitado" : "Pendente"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={u.ativo ? "badge-ativo" : "badge-inativo"}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ToggleAtivoUsuario email={u.email} ativo={u.ativo} />
                </td>
              </tr>
            ))}
            {usuarios?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
