import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatDate } from "@/lib/utils";
import { ToggleAtivoMotorista } from "./_components/ToggleAtivoMotorista";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export default async function MotoristasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; empresa?: string }>;
}) {
  const { q, empresa: empresaParam } = await searchParams;
  const supabase = await createClient();

  // Fase 27.5 — mesmo ajuste de /veiculos: a visão do admin não tinha
  // seletor de cliente aqui e misturava motoristas de todos os clientes.
  // motoristas já tem empresa_id (uuid), então o filtro é um .eq() direto.
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let query = supabase
    .from("motoristas")
    .select("id, nome_completo, cpf, telefone, classificacao, status, cnh_vencimento, empresas(nome)")
    .order("nome_completo");

  if (q) {
    query = query.or(`nome_completo.ilike.%${q}%,cpf.ilike.%${q}%`);
  }
  if (empresaSelecionada) {
    query = query.eq("empresa_id", empresaSelecionada);
  }

  const { data: motoristas, error } = semClienteEscolhido ? { data: [], error: null } : await query;

  let totalAtivos = 0;
  let totalGeral = 0;
  if (!semClienteEscolhido) {
    let queryAtivos = supabase.from("motoristas").select("id", { count: "exact", head: true }).eq("status", "Ativo");
    let queryGeral = supabase.from("motoristas").select("id", { count: "exact", head: true });
    if (empresaSelecionada) {
      queryAtivos = queryAtivos.eq("empresa_id", empresaSelecionada);
      queryGeral = queryGeral.eq("empresa_id", empresaSelecionada);
    }
    const [{ count: ativos }, { count: geral }] = await Promise.all([queryAtivos, queryGeral]);
    totalAtivos = ativos ?? 0;
    totalGeral = geral ?? 0;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Motoristas <AjudaIcon chave="motoristas.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastro de motoristas, CNH e vencimento, classificação e centro de custo
            {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/motoristas/importar" className="btn-secondary">
            Importar planilha
          </Link>
          <Link href="/motoristas/novo" className="btn-primary">
            + Novo Motorista
          </Link>
        </div>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      {semClienteEscolhido ? (
        <p className="p-4 text-sm text-slate-500">Selecione um cliente acima para ver os motoristas dele.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador label="Total de motoristas" valor={totalGeral} />
            <Indicador label="Ativos" valor={totalAtivos} />
            <Indicador label="Inativos" valor={totalGeral - totalAtivos} />
          </div>

          <form className="mb-4">
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por nome ou CPF..."
              className="input max-w-sm"
            />
          </form>

          <div className="card overflow-x-auto">
            {error && <p className="p-4 text-sm text-red-600">Erro ao carregar motoristas: {error.message}</p>}
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Classificação</th>
                  <th className="px-4 py-3">CNH vence em</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {motoristas?.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/motoristas/${m.id}`} className="font-medium text-frota-600 hover:underline">
                        {m.nome_completo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.cpf}</td>
                    <td className="px-4 py-3 text-slate-600">{m.telefone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{m.classificacao}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(m.cnh_vencimento)}</td>
                    <td className="px-4 py-3 text-slate-600">{m.empresas?.nome ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={m.status === "Ativo" ? "badge-ativo" : "badge-inativo"}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ToggleAtivoMotorista id={m.id} ativo={m.status === "Ativo"} />
                    </td>
                  </tr>
                ))}
                {motoristas?.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhum motorista encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
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
