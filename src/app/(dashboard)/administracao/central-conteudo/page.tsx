import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ToggleAtivoConteudo } from "./_components/ToggleAtivoConteudo";
import { BotaoExcluirConteudo } from "./_components/BotaoExcluirConteudo";

// Fase Central-Treinamento (20/07/2026) — pedido do Daniel: treinamento
// interativo pro usuário final, com conteúdo editável sem depender de
// deploy/time técnico. Esta tela (exclusiva do time FNI, perfil admin,
// mesmo padrão de /configuracoes) é o CRUD da tabela conteudo_ajuda —
// alimenta tanto o ícone "?" (tipo='contextual') quanto as lições da
// Central de Treinamento (tipo='licao', ver /treinamento).
export default async function CentralConteudoPage() {
  const supabase = await createClient();
  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");

  if (perfil !== "admin") {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esta tela é exclusiva do time interno (perfil administrador).
        </p>
      </div>
    );
  }

  const { data: itens } = await supabase
    .from("conteudo_ajuda")
    .select("id, chave, tipo, modulo, ordem, titulo, ativo, video_path")
    .order("tipo", { ascending: true })
    .order("modulo", { ascending: true, nullsFirst: true })
    .order("ordem", { ascending: true });

  const contextuais = (itens ?? []).filter((i) => i.tipo === "contextual");
  const licoes = (itens ?? []).filter((i) => i.tipo === "licao");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Central de Conteúdo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Textos do ícone de ajuda (?) e das lições da Central de Treinamento — editável aqui, sem
            precisar de deploy.
          </p>
        </div>
        <Link href="/administracao/central-conteudo/novo" className="btn-primary text-sm">
          + Nova entrada
        </Link>
      </div>

      <Secao titulo={`Lições da Central de Treinamento (${licoes.length})`} itens={licoes} />
      <Secao titulo={`Ajuda contextual — ícone "?" (${contextuais.length})`} itens={contextuais} />
    </div>
  );
}

function Secao({
  titulo,
  itens,
}: {
  titulo: string;
  itens: {
    id: number;
    chave: string;
    modulo: string | null;
    titulo: string;
    ativo: boolean;
    video_path: string | null;
  }[];
}) {
  return (
    <div className="card mb-6 overflow-x-auto p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{titulo}</h2>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Módulo</th>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Chave</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {itens.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 text-slate-600">{item.modulo ?? "—"}</td>
              <td className="px-4 py-3 font-medium text-slate-900">
                {item.titulo}
                {item.video_path && (
                  <span className="ml-2 rounded-full bg-frota-50 px-2 py-0.5 text-[10px] font-semibold text-frota-700">
                    🎥 Vídeo
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.chave}</td>
              <td className="px-4 py-3">
                <span className={item.ativo ? "badge-ativo" : "badge-inativo"}>{item.ativo ? "Ativo" : "Inativo"}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Link href={`/administracao/central-conteudo/${item.id}`} className="text-xs font-medium text-frota-600 hover:underline">
                    Editar
                  </Link>
                  <ToggleAtivoConteudo id={item.id} ativo={item.ativo} />
                  <BotaoExcluirConteudo id={item.id} />
                </div>
              </td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                Nenhuma entrada cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
