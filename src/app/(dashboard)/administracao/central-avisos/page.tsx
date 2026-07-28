import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHoraBr } from "@/lib/utils";
import { ToggleAtivoAviso } from "./_components/ToggleAtivoAviso";
import { BotaoExcluirAviso } from "./_components/BotaoExcluirAviso";

const TIPO_LABEL: Record<string, string> = {
  novidade: "🆕 Novidade",
  correcao: "🐛 Correção",
  manutencao: "🔧 Manutenção",
  aviso_geral: "📣 Aviso geral",
};

const URGENCIA_BADGE: Record<string, string> = {
  informativo: "bg-slate-100 text-slate-600",
  atencao: "bg-amber-50 text-amber-700",
  critico: "bg-red-50 text-red-700",
};

// Fase Central-Avisos (28/07/2026) — pedido do Daniel: canal oficial dentro
// da aplicação pra comunicar novidades, correções, manutenções/
// indisponibilidade e avisos gerais a clientes, motoristas e postos. Esta
// tela (exclusiva do time FNI, perfil admin) é o CRUD da tabela
// `comunicados` — mesmo padrão de /administracao/central-conteudo.
export default async function CentralAvisosPage() {
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

  const { data: itens } = await supabase
    .from("comunicados")
    .select("id, tipo, urgencia, titulo, fixado, ativo, data_publicacao, data_expiracao")
    .order("data_publicacao", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Central de Avisos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Novidades, correções, manutenções/indisponibilidade e avisos gerais — publicados aqui, sem precisar de
            deploy, chegam ao sino/drawer de clientes, motoristas e postos.
          </p>
        </div>
        <Link href="/administracao/central-avisos/novo" className="btn-primary text-sm">
          + Novo aviso
        </Link>
      </div>

      <div className="card overflow-x-auto p-6">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Urgência</th>
              <th className="px-4 py-3">Publicado em</th>
              <th className="px-4 py-3">Expira em</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(itens ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-slate-600">{TIPO_LABEL[item.tipo] ?? item.tipo}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {item.titulo}
                  {item.fixado && (
                    <span className="ml-2 rounded-full bg-frota-50 px-2 py-0.5 text-[10px] font-semibold text-frota-700">
                      📌 Fixado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCIA_BADGE[item.urgencia] ?? ""}`}>
                    {item.urgencia}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatarDataHoraBr(item.data_publicacao)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {item.data_expiracao ? formatarDataHoraBr(item.data_expiracao) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={item.ativo ? "badge-ativo" : "badge-inativo"}>{item.ativo ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/administracao/central-avisos/${item.id}`} className="text-xs font-medium text-frota-600 hover:underline">
                      Editar
                    </Link>
                    <ToggleAtivoAviso id={item.id} ativo={item.ativo} />
                    <BotaoExcluirAviso id={item.id} />
                  </div>
                </td>
              </tr>
            ))}
            {(itens ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum aviso cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
