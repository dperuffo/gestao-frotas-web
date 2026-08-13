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
import { Paginacao, calcularPaginacao } from "@/components/Paginacao";
// Fase Redesign-Telas-Densas / Backlog-Visao-Posto (13/08/2026) — mesmo
// toque visual já aplicado nas demais telas densas do app. AjudaIcon saiu
// daqui porque a única chamada era dentro do Indicador() local removido
// abaixo — IndicadorColorido já importa o próprio AjudaIcon internamente.
import { IndicadorColorido } from "@/components/IndicadorColorido";
import { Inbox, Search, CheckCircle2, Bell } from "lucide-react";

const POR_PAGINA = 30;

type SearchParams = { empresa?: string; status?: string; tipo?: string; prioridade?: string; q?: string; page?: string };

// Página de Gestão de Chamados: indicadores + listagem. Admin vê os
// chamados de todos os clientes por padrão (com filtro opcional pra um
// cliente específico); gestor de frota só enxerga os da própria empresa —
// nos dois casos o RLS já garante isso, o filtro aqui é só uma conveniência
// de navegação, igual ao padrão já usado em /relatorios.
export default async function ChamadosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, status: statusParam, tipo: tipoParam, prioridade: prioridadeParam, q, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const { papel } = await resolverPapelAtual(supabase);

  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: minhasEmpresasIds } = await supabase.rpc("empresas_do_usuario", { p_email: user?.email ?? "" });

  // Fase 27.2 — achado real: um usuário vinculado a mais de uma empresa (ex.:
  // grupo econômico) caía na MESMA condição do admin e recebia a base de
  // clientes inteira sem filtro nenhum. RLS de "empresas" já bloqueava o
  // vazamento de dado (só retorna linhas de empresas_do_usuario), mas o
  // código não devia depender só disso — corrigido pra filtrar
  // explicitamente por minhasEmpresasIds, que já cobre o próprio cliente e
  // as empresas "irmãs" do mesmo grupo econômico.
  let empresas: { id: string; nome: string }[] = [];
  if (perfil === "admin") {
    const { data } = await supabase.from("empresas").select("id, nome").order("nome");
    empresas = data ?? [];
  } else if (minhasEmpresasIds && minhasEmpresasIds.length > 0) {
    const { data } = await supabase.from("empresas").select("id, nome").in("id", minhasEmpresasIds).order("nome");
    empresas = data ?? [];
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
  const chamadosDoFiltro = chamadosRaw ?? [];

  // Fase busca-generica-listas (27/07/2026, pedido do Daniel: busca genérica
  // em telas que crescem com o tempo — chamados se acumulam a cada
  // atendimento) — filtra por título ou número, além dos filtros de
  // status/tipo/prioridade já existentes.
  const termoBusca = (q ?? "").trim().toLowerCase();
  const chamados = termoBusca
    ? chamadosDoFiltro.filter(
        (c) => c.titulo?.toLowerCase().includes(termoBusca) || String(c.numero).includes(termoBusca)
      )
    : chamadosDoFiltro;

  const totalAbertos = chamados.filter((c) => c.status === "aberto").length;
  const totalEmAnalise = chamados.filter((c) => c.status === "em_analise").length;
  const totalResolvidos = chamados.filter((c) => c.status === "resolvido" || c.status === "fechado").length;
  const totalNaoVistos = chamados.filter((c) => temAtualizacaoNaoVista(c, papel)).length;

  // Fase 27.12 — os indicadores acima continuam olhando pra TODOS os
  // chamados do filtro atual (não só a página visível); só a tabela abaixo é
  // paginada (30 por página), em memória — igual ao padrão de /veiculos,
  // já que a lista de chamados costuma ser bem menor que abastecimentos.
  const { paginaAtual, totalPaginas } = calcularPaginacao(chamados.length, POR_PAGINA, pageParam);
  const chamadosDaPagina = chamados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

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

      <form className="mb-4 flex flex-wrap items-end gap-2">
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Título ou número..."
            className="input text-sm"
          />
        </div>
        <button type="submit" className="btn-secondary text-sm">
          Filtrar
        </button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <IndicadorColorido cor="amber" icon={Inbox} label="Abertos" valor={String(totalAbertos)} ajudaChave="chamados.status" />
        <IndicadorColorido cor="sky" icon={Search} label="Em análise" valor={String(totalEmAnalise)} ajudaChave="chamados.status" />
        <IndicadorColorido cor="green" icon={CheckCircle2} label="Resolvidos" valor={String(totalResolvidos)} ajudaChave="chamados.status" />
        <IndicadorColorido cor="red" icon={Bell} label="Com atualização não vista" valor={String(totalNaoVistos)} />
      </div>

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
            {chamadosDaPagina.map((c) => {
              const naoVisto = temAtualizacaoNaoVista(c, papel);
              const corStatus = CORES_STATUS[c.status as TicketStatus] ?? CORES_STATUS.aberto;
              const corPrioridade = CORES_PRIORIDADE[(c.prioridade as TicketPrioridade) ?? "media"] ?? CORES_PRIORIDADE.media;
              return (
                <tr key={c.id} className={`transition-colors hover:bg-frota-50/60 ${naoVisto ? "bg-red-50/40" : ""}`}>
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
                  {termoBusca ? `Nenhum chamado encontrado para "${q}".` : "Nenhum chamado encontrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4">
          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={chamados.length}
            porPagina={POR_PAGINA}
            basePath="/chamados"
            paramsAtuais={{ empresa: empresaParam, status: statusParam, tipo: tipoParam, prioridade: prioridadeParam, q }}
          />
        </div>
      </div>
    </div>
  );
}

// Indicador() local removido — troca pelo IndicadorColorido compartilhado
// (@/components/IndicadorColorido, ver Fase Redesign-Telas-Densas).
