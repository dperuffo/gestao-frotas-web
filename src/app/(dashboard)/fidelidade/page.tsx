import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ToggleAtivoItemCatalogo } from "./_components/ToggleAtivoItemCatalogo";
import { ExcluirItemCatalogo } from "./_components/ExcluirItemCatalogo";

const CATEGORIAS = [
  { valor: "economia_imediata", label: "Economia Imediata" },
  { valor: "marketplace_cabine", label: "Marketplace da Cabine" },
  { valor: "saude_estrada", label: "Saúde na Estrada" },
  { valor: "universidade_estrada", label: "Universidade da Estrada" },
  { valor: "clube_caminhao", label: "Clube do Caminhão" },
  { valor: "volte_para_casa", label: "Volte para Casa" },
] as const;
const LABEL_CATEGORIA: Record<string, string> = Object.fromEntries(CATEGORIAS.map((c) => [c.valor, c.label]));

type Categoria = (typeof CATEGORIAS)[number]["valor"];
function eCategoriaValida(v: string): v is Categoria {
  return (CATEGORIAS as readonly { valor: string }[]).some((c) => c.valor === v);
}

type ItemRow = {
  id: string;
  categoria: string;
  titulo: string;
  parceiro_nome: string | null;
  pontos_necessarios: number;
  ativo: boolean;
};

export default async function FidelidadePage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria: categoriaParam } = await searchParams;
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

  let query = supabase
    .from("fidelidade_catalogo_itens")
    .select("id, categoria, titulo, parceiro_nome, pontos_necessarios, ativo")
    .order("categoria")
    .order("pontos_necessarios");
  if (categoriaParam && eCategoriaValida(categoriaParam)) query = query.eq("categoria", categoriaParam);
  const { data, error } = await query;
  const itens = (data ?? []) as ItemRow[];

  function linkCategoria(valor: string) {
    return valor ? `?categoria=${valor}` : "?";
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">🎁 Catálogo de Fidelidade</h1>
          <p className="mt-1 text-sm text-slate-500">
            Itens que o motorista resgata no app &quot;Estrada que Cuida&quot; gastando pontos — catálogo simulado
            (v1), sem parceiros reais nem pagamento/entrega integrados.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/fidelidade/resgates" className="btn-secondary">
            Ver resgates
          </Link>
          <Link href="/fidelidade/novo" className="btn-primary">
            + Novo Item
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Link
          href={linkCategoria("")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!categoriaParam ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Todas
        </Link>
        {CATEGORIAS.map((c) => (
          <Link
            key={c.valor}
            href={linkCategoria(c.valor)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${categoriaParam === c.valor ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar catálogo: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Parceiro (simulado)</th>
              <th className="px-4 py-3">Pontos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-frota-50/60">
                <td className="px-4 py-3 font-medium text-slate-900">{item.titulo}</td>
                <td className="px-4 py-3 text-slate-600">{LABEL_CATEGORIA[item.categoria] ?? item.categoria}</td>
                <td className="px-4 py-3 text-slate-600">{item.parceiro_nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{item.pontos_necessarios.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <span className={item.ativo ? "badge-ativo" : "badge-inativo"}>{item.ativo ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/fidelidade/${item.id}/editar`} className="text-xs font-medium text-frota-600 hover:underline">
                      Editar
                    </Link>
                    <ToggleAtivoItemCatalogo id={item.id} ativo={item.ativo} />
                    <ExcluirItemCatalogo id={item.id} titulo={item.titulo} />
                  </div>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum item cadastrado. Clique em &quot;Novo Item&quot; para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
