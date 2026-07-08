import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

export default async function GrupoEconomicoPage() {
  const supabase = await createClient();

  // Fase 27.87 — a mesma tabela agora também guarda Rede de Postos
  // (segmento='Revenda', ver /rede-postos); filtra só os grupos de
  // clientes (segmento='Frota') pra não misturar os dois nesta lista.
  const { data: grupos, error } = await supabase
    .from("grupos_economicos")
    .select("id, nome, cnpj_matriz, ativo, grupos_economicos_empresas(count)")
    .eq("segmento", "Frota")
    .order("nome");

  const totalGrupos = grupos?.length ?? 0;
  const totalAtivos = grupos?.filter((g) => g.ativo).length ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">
            Grupo Econômico <AjudaIcon chave="grupo_economico.pagina" />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Agrupamento de clientes sob um mesmo grupo econômico.
          </p>
        </div>
        <Link href="/grupo-economico/novo" className="btn-primary">
          + Novo Grupo
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Indicador label="Total de grupos" valor={totalGrupos} />
        <Indicador label="Ativos" valor={totalAtivos} />
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar grupos: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">CNPJ Matriz</th>
              <th className="px-4 py-3">Clientes vinculados</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grupos?.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/grupo-economico/${g.id}`} className="font-medium text-frota-600 hover:underline">
                    {g.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{g.cnpj_matriz ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(g.grupos_economicos_empresas as unknown as { count: number }[])?.[0]?.count ?? 0}
                </td>
                <td className="px-4 py-3">
                  <span className={g.ativo ? "badge-ativo" : "badge-inativo"}>
                    {g.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
              </tr>
            ))}
            {grupos?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Nenhum grupo econômico cadastrado.
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
