import Link from "next/link";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { createClient } from "@/lib/supabase/server";
import { ToggleAtivoOficina } from "./_components/ToggleAtivoOficina";
import { BotaoExcluirOficina } from "./_components/BotaoExcluirOficina";

// Fase Onda-2 (benchmark TicketLog, item #5) — CRUD do catálogo nacional de
// oficinas credenciadas. Exclusiva do time FNI (perfil admin), mesmo padrão
// de /administracao/central-avisos e /administracao/postos-revendedores.
export default async function OficinasCredenciadasPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Esta tela é exclusiva do time interno (perfil administrador).</p>
      </div>
    );
  }

  const { data: itens } = await supabase
    .from("oficinas_credenciadas")
    .select("id, nome, municipio, uf, especialidades, avaliacao_media, ativo")
    .order("nome");

  return (
    <div>
      <CabecalhoPagina
        titulo="Oficinas Credenciadas"
        descricao="Catálogo nacional de oficinas parceiras, exibido aos clientes em /oficinas."
        acoes={
          <Link href="/administracao/oficinas-credenciadas/novo" className="btn-primary text-sm">
            + Nova oficina
          </Link>
        }
      />

      <div className="card overflow-x-auto p-6">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Local</th>
              <th className="px-4 py-3">Especialidades</th>
              <th className="px-4 py-3">Avaliação</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {(itens ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{item.nome}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{[item.municipio, item.uf].filter(Boolean).join(" / ") || "—"}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{(item.especialidades ?? []).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.avaliacao_media != null ? `⭐ ${item.avaliacao_media.toFixed(1)}` : "—"}</td>
                <td className="px-4 py-3">
                  <span className={item.ativo ? "badge-ativo" : "badge-inativo"}>{item.ativo ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/administracao/oficinas-credenciadas/${item.id}`} className="text-xs font-medium text-frota-600 hover:underline">
                      Editar
                    </Link>
                    <ToggleAtivoOficina id={item.id} ativo={item.ativo} />
                    <BotaoExcluirOficina id={item.id} />
                  </div>
                </td>
              </tr>
            ))}
            {(itens ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma oficina cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
