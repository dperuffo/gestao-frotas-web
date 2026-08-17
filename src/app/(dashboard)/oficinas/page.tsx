import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { AbasPainel } from "../inteligencia-rede/_components/AbasPainel";
import { PedidoOrcamentoCard } from "./_components/OficinaAcoes";
import { CatalogoOficinasComSelecao } from "./_components/CatalogoOficinasComSelecao";
import { ESPECIALIDADES_OFICINA } from "@/lib/oficinas";

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

  // Fase marketplace-pecas (04/08/2026) — 1 pedido pode ter N propostas
  // (1 por oficina escolhida); a aba "Minhas Solicitações" agora agrupa por
  // pedido pra comparação lado a lado, em vez de listar 1 linha por oficina.
  type Pedido = {
    id: string;
    placa: string | null;
    descricao_servico: string;
    status: string;
    criado_em: string;
    propostas_orcamento_oficina: {
      id: string;
      status: string;
      valor_orcado: number | null;
      prazo_execucao: string | null;
      observacoes_oficina: string | null;
      oficinas_credenciadas: { nome: string } | null;
    }[];
  };

  // Fase Auditoria-Paginacao (17/08/2026, risco médio) — cap fixo de 100 sem
  // UI de página 2. Busca em lotes de 1.000 até esgotar.
  const LOTE_PEDIDOS = 1000;
  let pedidos: Pedido[] = [];
  if (empresaSelecionada) {
    let offsetBusca = 0;
    for (;;) {
      const { data: lote } = await supabase
        .from("pedidos_orcamento_oficina")
        .select(
          "id, placa, descricao_servico, status, criado_em, propostas_orcamento_oficina(id, status, valor_orcado, prazo_execucao, observacoes_oficina, oficinas_credenciadas(nome))"
        )
        .eq("empresa_id", empresaSelecionada)
        .order("criado_em", { ascending: false })
        .range(offsetBusca, offsetBusca + LOTE_PEDIDOS - 1);
      const linhas = (lote ?? []) as unknown as Pedido[];
      if (linhas.length === 0) break;
      pedidos.push(...linhas);
      if (linhas.length < LOTE_PEDIDOS) break;
      offsetBusca += LOTE_PEDIDOS;
    }
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

                <CatalogoOficinasComSelecao oficinas={oficinas} empresaId={empresaSelecionada} placas={placas} />
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
                {pedidos.map((p) => (
                  <PedidoOrcamentoCard
                    key={p.id}
                    placa={p.placa}
                    descricaoServico={p.descricao_servico}
                    criadoEm={p.criado_em}
                    statusPedido={p.status}
                    propostas={p.propostas_orcamento_oficina}
                  />
                ))}
                {pedidos.length === 0 && (
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
