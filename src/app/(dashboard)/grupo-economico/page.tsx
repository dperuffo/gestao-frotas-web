import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";
import { BotaoExportarTabela } from "@/components/exportar/BotaoExportarTabela";
// Fase Redesign-Telas-Densas / Backlog-Visao-Admin (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { GitBranch, CheckCircle2 } from "lucide-react";

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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <IndicadorColorido cor="sky" icon={GitBranch} label="Total de grupos" valor={String(totalGrupos)} />
        <IndicadorColorido cor="green" icon={CheckCircle2} label="Ativos" valor={String(totalAtivos)} />
      </div>

      <div className="mb-4 flex justify-end">
        <BotaoExportarTabela
          nomeArquivo="grupo-economico"
          titulo="Grupo Econômico"
          colunas={[
            { header: "Nome", chave: "nome" },
            { header: "CNPJ Matriz", chave: "cnpjMatriz" },
            { header: "Clientes vinculados", chave: "vinculados" },
            { header: "Status", chave: "status" },
          ]}
          linhas={(grupos ?? []).map((g) => ({
            nome: g.nome,
            cnpjMatriz: g.cnpj_matriz ?? "—",
            vinculados: (g.grupos_economicos_empresas as unknown as { count: number }[])?.[0]?.count ?? 0,
            status: g.ativo ? "Ativo" : "Inativo",
          }))}
        />
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
              <tr key={g.id} className="transition-colors hover:bg-frota-50/60">
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

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
