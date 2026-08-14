import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { AtualizarStatusResgate } from "./_components/AtualizarStatusResgate";

const LABEL_CATEGORIA: Record<string, string> = {
  economia_imediata: "Economia Imediata",
  marketplace_cabine: "Marketplace da Cabine",
  saude_estrada: "Saúde na Estrada",
  universidade_estrada: "Universidade da Estrada",
  clube_caminhao: "Clube do Caminhão",
  volte_para_casa: "Volte para Casa",
};

const STATUS_RESGATE = ["solicitado", "em_andamento", "concluido", "cancelado"] as const;
type StatusResgate = (typeof STATUS_RESGATE)[number];
function eStatusValido(v: string): v is StatusResgate {
  return (STATUS_RESGATE as readonly string[]).includes(v);
}

type ResgateRow = {
  id: string;
  motorista_id: string;
  dependente_id: string | null;
  categoria: string;
  titulo: string;
  pontos_gastos: number;
  status: string;
  solicitado_em: string;
};

export default async function ResgatesFidelidadePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
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
    .from("fidelidade_resgates")
    .select("id, motorista_id, dependente_id, categoria, titulo, pontos_gastos, status, solicitado_em")
    .order("solicitado_em", { ascending: false });
  if (statusParam && eStatusValido(statusParam)) query = query.eq("status", statusParam);
  const { data, error } = await query;
  const resgates = (data ?? []) as ResgateRow[];

  const motoristaIds = Array.from(new Set(resgates.map((r) => r.motorista_id)));
  const dependenteIds = Array.from(new Set(resgates.map((r) => r.dependente_id).filter((v): v is string => !!v)));

  const [{ data: motoristas }, { data: dependentes }] = await Promise.all([
    motoristaIds.length
      ? supabase.from("motoristas").select("id, nome_completo").in("id", motoristaIds)
      : Promise.resolve({ data: [] as { id: string; nome_completo: string }[] }),
    dependenteIds.length
      ? supabase.from("fidelidade_dependentes").select("id, nome").in("id", dependenteIds)
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);
  const nomeMotorista = new Map((motoristas ?? []).map((m) => [m.id, m.nome_completo]));
  const nomeDependente = new Map((dependentes ?? []).map((d) => [d.id, d.nome]));

  function linkFiltro(valor: string) {
    return valor ? `?status=${valor}` : "?";
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-slate-900">🎁 Resgates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pedidos de resgate feitos pelos motoristas no catálogo — atualize o status conforme for cumprindo
            (manualmente) cada benefício.
          </p>
        </div>
        <Link href="/fidelidade" className="btn-secondary">
          Ver catálogo
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Link
          href={linkFiltro("")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!statusParam ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Todos
        </Link>
        {["solicitado", "em_andamento", "concluido", "cancelado"].map((s) => (
          <Link
            key={s}
            href={linkFiltro(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusParam === s ? "bg-frota-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {s === "solicitado" ? "Solicitado" : s === "em_andamento" ? "Em andamento" : s === "concluido" ? "Concluído" : "Cancelado"}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar resgates: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Pontos</th>
              <th className="px-4 py-3">Pedido em</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resgates.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-frota-50/60">
                <td className="px-4 py-3 text-slate-900">
                  {nomeMotorista.get(r.motorista_id) ?? r.motorista_id}
                  {r.dependente_id && (
                    <span className="block text-xs text-slate-500">
                      Para: {nomeDependente.get(r.dependente_id) ?? "dependente"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{r.titulo}</td>
                <td className="px-4 py-3 text-slate-600">{LABEL_CATEGORIA[r.categoria] ?? r.categoria}</td>
                <td className="px-4 py-3 text-slate-600">{r.pontos_gastos.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(r.solicitado_em)}</td>
                <td className="px-4 py-3">
                  <AtualizarStatusResgate id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
            {resgates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum resgate ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
