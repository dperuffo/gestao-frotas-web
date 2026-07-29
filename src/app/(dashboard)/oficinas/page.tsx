import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { AbasPainel } from "../inteligencia-rede/_components/AbasPainel";
import { SolicitarOrcamentoButton, RespostaOrcamentoForm, DecisaoOrcamentoBotoes } from "./_components/OficinaAcoes";
import { ESPECIALIDADES_OFICINA, STATUS_ORCAMENTO_LABEL, STATUS_ORCAMENTO_COR } from "@/lib/oficinas";

type SearchParams = { empresa?: string; uf?: string; especialidade?: string; q?: string };

// Fase Onda-2 (benchmark TicketLog, item #5) — Rede de Oficinas
// Credenciadas com Orçamento, primeira versão: catálogo nacional (admin
// credencia em /administracao/oficinas-credenciadas) + fluxo simples de
// solicitação (o gestor registra o retorno recebido por telefone/e-mail —
// sem portal pra oficina responder na v1, ver actions.ts).
export default async function OficinasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { empresa: empresaParam, uf, especialidade, q } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);

  type Oficina = {
    id: string;
    nome: string;
    especialidades: string[];
    telefone: string | null;
    email: string | null;
    municipio: string | null;
    uf: string | null;
    avaliacao_media: number | null;
  };

  let query = supabase
    .from("oficinas_credenciadas")
    .select("id, nome, especialidades, telefone, email, municipio, uf, avaliacao_media")
    .eq("ativo", true)
    .order("nome");
  if (uf) query = query.eq("uf", uf);
  if (especialidade) query = query.contains("especialidades", [especialidade]);
  const { data: oficinasRaw } = await query;

  const termoBusca = (q ?? "").trim().toLowerCase();
  const oficinas = (
    termoBusca
      ? (oficinasRaw ?? []).filter(
          (o) => o.nome.toLowerCase().includes(termoBusca) || o.municipio?.toLowerCase().includes(termoBusca)
        )
      : (oficinasRaw ?? [])
  ) as Oficina[];

  let placas: string[] = [];
  if (empresaSelecionada) {
    const { data: veiculosDaEmpresa } = await supabase.rpc("veiculos_da_empresa", { p_empresa_id: empresaSelecionada });
    placas = (veiculosDaEmpresa ?? []).map((v) => v.placa).filter((p): p is string => Boolean(p)).sort();
  }

  type Solicitacao = {
    id: string;
    placa: string | null;
    descricao_servico: string;
    status: string;
    valor_orcado: number | null;
    prazo_execucao: string | null;
    observacoes_oficina: string | null;
    criado_em: string;
    oficinas_credenciadas: { nome: string } | null;
  };

  let solicitacoes: Solicitacao[] = [];
  if (empresaSelecionada) {
    const { data } = await supabase
      .from("solicitacoes_orcamento_oficina")
      .select(
        "id, placa, descricao_servico, status, valor_orcado, prazo_execucao, observacoes_oficina, criado_em, oficinas_credenciadas(nome)"
      )
      .eq("empresa_id", empresaSelecionada)
      .order("criado_em", { ascending: false })
      .limit(100);
    solicitacoes = (data ?? []) as unknown as Solicitacao[];
  }

  const ufsDisponiveis = Array.from(new Set((oficinasRaw ?? []).map((o) => o.uf).filter(Boolean))).sort() as string[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Rede de Oficinas Credenciadas</h1>
        <p className="mt-1 text-sm text-slate-500">Catálogo de oficinas parceiras e solicitação simples de orçamento.</p>
      </div>

      {empresas.length > 1 && (
        <form className="mb-4 flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <select name="empresa" defaultValue={empresaSelecionada ?? ""} className="input text-sm">
              <option value="">Selecione um cliente...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Filtrar
          </button>
        </form>
      )}

      <AbasPainel
        abas={[
          {
            id: "catalogo",
            label: "🔧 Catálogo",
            conteudo: (
              <div>
                <form className="mb-4 flex flex-wrap items-end gap-2">
                  {empresaSelecionada && <input type="hidden" name="empresa" value={empresaSelecionada} />}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
                    <input type="search" name="q" defaultValue={q ?? ""} placeholder="Nome ou município..." className="input text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Estado (UF)</label>
                    <select name="uf" defaultValue={uf ?? ""} className="input text-sm">
                      <option value="">Todos</option>
                      {ufsDisponiveis.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Especialidade</label>
                    <select name="especialidade" defaultValue={especialidade ?? ""} className="input text-sm">
                      <option value="">Todas</option>
                      {ESPECIALIDADES_OFICINA.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn-secondary text-sm">
                    Filtrar
                  </button>
                </form>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {oficinas.map((o) => (
                    <div key={o.id} className="card p-4">
                      <p className="font-medium text-slate-900">{o.nome}</p>
                      <p className="text-xs text-slate-500">
                        {[o.municipio, o.uf].filter(Boolean).join(" / ") || "—"}
                        {o.avaliacao_media != null && ` · ⭐ ${o.avaliacao_media.toFixed(1)}`}
                      </p>
                      {o.especialidades.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {o.especialidades.map((e) => (
                            <span key={e} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        {o.telefone ?? ""} {o.email ? `· ${o.email}` : ""}
                      </p>
                      <div className="mt-3">
                        {empresaSelecionada ? (
                          <SolicitarOrcamentoButton empresaId={empresaSelecionada} oficinaId={o.id} oficinaNome={o.nome} placas={placas} />
                        ) : (
                          <p className="text-xs text-slate-400">Selecione um cliente para solicitar orçamento.</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {oficinas.length === 0 && (
                    <p className="col-span-full py-8 text-center text-sm text-slate-400">Nenhuma oficina encontrada para esse filtro.</p>
                  )}
                </div>
              </div>
            ),
          },
          {
            id: "solicitacoes",
            label: "📋 Minhas Solicitações",
            conteudo: !empresaSelecionada ? (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Selecione um cliente para ver as solicitações.</p>
            ) : (
              <div className="space-y-3">
                {solicitacoes.map((s) => (
                  <div key={s.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">
                          {s.oficinas_credenciadas?.nome ?? "Oficina"} {s.placa ? `· ${s.placa}` : ""}
                        </p>
                        <p className="text-sm text-slate-600">{s.descricao_servico}</p>
                        <p className="text-xs text-slate-400">{new Date(s.criado_em).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_ORCAMENTO_COR[s.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {STATUS_ORCAMENTO_LABEL[s.status] ?? s.status}
                      </span>
                    </div>

                    {s.valor_orcado != null && (
                      <p className="mt-2 text-sm text-slate-700">
                        Orçado: <strong>{s.valor_orcado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                        {s.prazo_execucao ? ` · Prazo: ${s.prazo_execucao}` : ""}
                      </p>
                    )}
                    {s.observacoes_oficina && <p className="mt-1 text-sm text-slate-500">{s.observacoes_oficina}</p>}

                    <div className="mt-3 flex items-center gap-3">
                      {s.status === "solicitado" && <RespostaOrcamentoForm id={s.id} />}
                      {s.status === "respondido" && <DecisaoOrcamentoBotoes id={s.id} />}
                    </div>
                  </div>
                ))}
                {solicitacoes.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">Nenhuma solicitação de orçamento ainda.</p>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
