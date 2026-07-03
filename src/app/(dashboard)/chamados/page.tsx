import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { resolverPapelAtual } from "./actions";
import {
  CORES_PRIORIDADE,
  CORES_STATUS,
  PRIORIDADES_TICKET,
  STATUS_TICKET,
  TIPOS_TICKET,
  prioridadeLabel,
  statusLabel,
  temAtualizacaoNaoVista,
  tipoLabel,
  type TicketPrioridade,
  type TicketStatus,
  type TicketTipo,
} from "@/lib/chamados";
import { AjudaIcon } from "@/components/ajuda/AjudaIcon";

type SearchParams = { empresa?: string; status?: string; tipo?: string; prioridade?: string };

// Página de Gestão de Chamados: indicadores + listagem. Admin vê os
// chamados de todos os clientes por padrão (com filtro opcional pra um
// cliente específico); gestor de frota só enxerga os da própria empresa —
// nos dois casos o RLS já garante isso, o filtro aqui é só uma conveniência
// de navegação, igual ao padrão já usado em /relatorios.
export default async function ChamadosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, status: statusParam, tipo: tipoParam, prioridade: prioridadeParam } = await searchParams;
  const supabase = await createClient();

  const { papel } = await resolverPapelAtual(supabase);

  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });

  let empresas: { id: string; nome: string }[] = [];
  if (perfil === "admin" || (minhasEmpresasIds?.length ?? 0) > 1) {
    const { data } = await supabase.from("empresas").select("id, nome").order("nome");
    empresas = data ?? [];
  } else if (minhasEmpresasIds && minhasEmpresasIds.length === 1) {
    const { data } = await supabase.from("empresas").select("id, nome").eq("id", minhasEmpresasIds[0]).maybeSingle();
    empresas = data ? [data] : [];
  }
  const empresaSelecionada = empresaParam && empresas.some((e) => e.id === empresaParam) ? empresaParam : null;

  let query = supabase
    .from("tickets")
    .select("id, numero, empresa_id, user_email, tipo, titulo, status, prioridade, criado_em, atualizado_em, usuario_visto_em, admin_visto_em, empresas(nome)")
    .order("criado_em", { ascending: false });

  if (empresaSelecionada) query = query.eq("empresa_id", empresaSelecionada);
  if (statusParam) query = query.eq("status", statusParam as TicketStatus);
  if (tipoParam) query = query.eq("tipo", tipoParam as TicketTipo);
  if (prioridadeParam) query = query.eq("prioridade", prioridadeParam as TicketPrioridade);

  const { data: chamadosRaw, error } = await query;
  const chamados = chamadosRaw ?? [];

  const totalAbertos = chamados.filter((c) => c.status === "aberto").length;
  const totalEmAnalise = chamados.filter((c) => c.status === "em_analise").length;
  const totalResolvidos = chamados.filter((c) => c.status === "resolvido" || c.status === "fechado").length;
  const totalNaoVistos = chamados.filter((c) => temAtualizacaoNaoVista(c, papel)).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">🎫 Gestão de Chamados</h1>
          <p className="mt-1 text-sm text-slate-500">
            {papel === "admin"
              ? "Acompanhe e responda os chamados abertos por todos os clientes."
              : "Abra chamados e acompanhe as respostas da equipe FNI."}
          </p>
        </div>
        <Link href="/chamados/novo" className="btn-primary">
          + Novo Chamado
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Indicador label="Abertos" valor={totalAbertos} corDestaque="text-amber-600" ajudaChave="chamados.status" />
        <Indicador label="Em análise" valor={totalEmAnalise} corDestaque="text-blue-600" ajudaChave="chamados.status" />
        <Indicador label="Resolvidos" valor={totalResolvidos} corDestaque="text-emerald-600" ajudaChave="chamados.status" />
        <Indicador label="Com atualização não vista" valor={totalNaoVistos} corDestaque="text-red-600" />
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        {empresas.length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Todos os clientes</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
          <select name="status" defaultValue={statusParam ?? ""} className="input text-sm">
            <option value="">Todos</option>
            {STATUS_TICKET.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
          <select name="tipo" defaultValue={tipoParam ?? ""} className="input text-sm">
            <option value="">Todos</option>
            {TIPOS_TICKET.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.icone} {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Prioridade</label>
          <select name="prioridade" defaultValue={prioridadeParam ?? ""} className="input text-sm">
            <option value="">Todas</option>
            {PRIORIDADES_TICKET.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      <div className="card overflow-x-auto">
        {error && <p className="p-4 text-sm text-red-600">Erro ao carregar chamados: {error.message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Título</th>
              {empresas.length > 1 && <th className="px-4 py-3">Cliente</th>}
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Prioridade</th>
              <th className="px-4 py-3">Aberto em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {chamados.map((c) => {
              const naoVisto = temAtualizacaoNaoVista(c, papel);
              const corStatus = CORES_STATUS[c.status as TicketStatus] ?? CORES_STATUS.aberto;
              const corPrioridade = CORES_PRIORIDADE[(c.prioridade as TicketPrioridade) ?? "media"] ?? CORES_PRIORIDADE.media;
              return (
                <tr key={c.id} className={`hover:bg-slate-50 ${naoVisto ? "bg-red-50/40" : ""}`}>
                  <td className="px-4 py-3 text-slate-500">#{c.numero}</td>
                  <td className="px-4 py-3">
                    <Link href={`/chamados/${c.id}`} className="flex items-center gap-2 font-medium text-frota-600 hover:underline">
                      {naoVisto && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" title="Atualização não vista" />}
                      {c.titulo}
                    </Link>
                  </td>
                  {empresas.length > 1 && <td className="px-4 py-3 text-slate-600">{c.empresas?.nome ?? "—"}</td>}
                  <td className="px-4 py-3 text-slate-600">{tipoLabel(c.tipo as TicketTipo)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${corStatus.bg} ${corStatus.text} ${corStatus.border}`}>
                      {statusLabel(c.status as TicketStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${corPrioridade.bg} ${corPrioridade.text} ${corPrioridade.border}`}>
                      {prioridadeLabel((c.prioridade as TicketPrioridade) ?? "media")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.criado_em ? formatDate(c.criado_em) : "—"}</td>
                </tr>
              );
            })}
            {chamados.length === 0 && (
              <tr>
                <td colSpan={empresas.length > 1 ? 7 : 6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum chamado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Indicador({
  label,
  valor,
  corDestaque,
  ajudaChave,
}: {
  label: string;
  valor: number;
  corDestaque: string;
  ajudaChave?: string;
}) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label} {ajudaChave && <AjudaIcon chave={ajudaChave} />}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${corDestaque}`}>{valor}</p>
    </div>
  );
}
