import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LABEL_STATUS_DOCUMENTACAO, STATUS_DOCUMENTACAO, type StatusDocumentacao } from "@/lib/empresasDocumentos";

type SearchParams = { status?: string; q?: string };

const COR_STATUS: Record<StatusDocumentacao, string> = {
  nao_iniciada: "bg-slate-100 text-slate-600",
  pendente: "bg-amber-100 text-amber-700",
  aprovada: "bg-green-100 text-green-700",
  rejeitada: "bg-red-100 text-red-700",
};

// Fase 27.149 — fila de revisão do admin (mesmo espírito de
// /postos-duplicados): lista empresas por status de documentação, com aba
// "Pendente" como padrão (é o que o admin precisa agir). Detalhe/decisão
// fica em /documentos-empresas/[id].
export default async function DocumentosEmpresasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">Esta tela é exclusiva do time interno (perfil administrador).</p>
      </div>
    );
  }

  const { status: statusParam, q } = await searchParams;
  const status: StatusDocumentacao = (STATUS_DOCUMENTACAO as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as StatusDocumentacao)
    : "pendente";

  const [{ data: lista }, ...contagens] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, nome, cnpj, segmento, documentacao_status, documentacao_enviada_em, documentacao_revisado_em")
      .eq("documentacao_status", status)
      .order("documentacao_enviada_em", { ascending: true, nullsFirst: true }),
    ...STATUS_DOCUMENTACAO.map((s) => supabase.from("empresas").select("id", { count: "exact", head: true }).eq("documentacao_status", s)),
  ]);

  const contagemPorStatus = Object.fromEntries(STATUS_DOCUMENTACAO.map((s, i) => [s, contagens[i].count ?? 0])) as Record<
    StatusDocumentacao,
    number
  >;

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas que crescem com o tempo — a fila de documentação aumenta junto
  // com a base de clientes/postos cadastrados) — filtra em memória por
  // nome ou CNPJ, mantendo o filtro de status já existente.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const listaCompleta = lista ?? [];
  const listaFiltrada = termoBusca
    ? listaCompleta.filter((e) => e.nome?.toLowerCase().includes(termoBusca) || e.cnpj?.toLowerCase().includes(termoBusca))
    : listaCompleta;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Aprovação de Documentos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Documentação societária/cadastral enviada por postos e clientes — aprovada, libera criar/aderir a
          Redes de Postos ou Grupos Econômicos e aceitar/criar negociações.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {STATUS_DOCUMENTACAO.map((s) => (
          <Link
            key={s}
            href={`/documentos-empresas?status=${s}`}
            className={`rounded-full px-3 py-1 font-medium ${status === s ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {LABEL_STATUS_DOCUMENTACAO[s]} ({contagemPorStatus[s]})
          </Link>
        ))}
      </div>

      {listaCompleta.length > 0 && (
        <form className="mb-4">
          <input type="hidden" name="status" value={status} />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por empresa ou CNPJ..."
            className="input max-w-sm"
          />
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3">Enviada em</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listaFiltrada.map((e) => (
              <tr key={e.id} className="transition-colors hover:bg-frota-50/60">
                <td className="px-4 py-3 font-medium text-slate-800">{e.nome}</td>
                <td className="px-4 py-3 text-slate-600">{e.cnpj ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{e.segmento === "Revenda" ? "Posto" : "Cliente"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.documentacao_enviada_em ? new Date(e.documentacao_enviada_em).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_STATUS[e.documentacao_status as StatusDocumentacao]}`}>
                    {LABEL_STATUS_DOCUMENTACAO[e.documentacao_status as StatusDocumentacao]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/documentos-empresas/${e.id}`} className="font-medium text-frota-600 hover:underline">
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
            {listaFiltrada.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {termoBusca
                    ? `Nenhuma empresa encontrada para "${q}".`
                    : `Nenhuma empresa com documentação "${LABEL_STATUS_DOCUMENTACAO[status].toLowerCase()}".`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
