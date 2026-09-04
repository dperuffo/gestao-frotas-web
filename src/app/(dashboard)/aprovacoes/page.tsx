import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { formatarMoeda } from "@/lib/financeiro";
import { formatarDataHoraBr } from "@/lib/utils";
import { Paginacao, calcularPaginacao, offsetDaPagina } from "@/components/Paginacao";
import { NovaSolicitacaoForm } from "./_components/NovaSolicitacaoForm";
import { AcoesSolicitacao } from "./_components/AcoesSolicitacao";
import { GraficoAprovacoes, type ItemDistribuicao, type ItemValorCategoria } from "./_components/GraficoAprovacoes";

const POR_PAGINA = 20;

const CATEGORIA_LABEL: Record<string, string> = {
  manutencao: "Manutenção",
  frete: "Negociação de frete",
  peca: "Compra de peça",
  outro: "Outro",
};

const STATUS_BADGE: Record<string, string> = {
  pendente: "badge-atencao",
  aprovada: "badge-ativo",
  reprovada: "badge-inativo",
  executada: "badge-ativo",
  cancelada: "badge-inativo",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  executada: "Executada",
  cancelada: "Cancelada",
};

// Fase Gestao-Controles (27/08/2026, pedido do Daniel: "gestao e controles
// mais diretos" / item do roadmap "Fluxo de aprovação em múltiplos níveis")
// — ver o comentário grande na migração solicitacoes_aprovacao pro escopo
// completo (módulo de solicitação -> aprovação -> execução, com histórico;
// 2 níveis quando o valor passa de R$ 2.000).
//
// Fase Aprovacao-Enforcement (27/08/2026, achado do Daniel: nada impedia
// lançar a manutenção direto, pulando a aprovação) — categoria "manutencao"
// agora É de fato enforced: o trigger verificar_aprovacao_manutencao
// bloqueia, a nível de banco, o lançamento em /manutencao-preditiva quando
// o custo bate o limite configurado (motor de regras único) sem uma
// solicitação aprovada vinculada — ver essa migration pro detalhe. Frete e
// compra de peça continuam como só tracker solto por enquanto.
export default async function AprovacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; page?: string; categoria?: string; valor?: string; titulo?: string }>;
}) {
  const { empresa: empresaParam, page: pageParam, categoria: categoriaParam, valor: valorParam, titulo: tituloParam } =
    await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let itens: {
    id: string;
    categoria: string;
    titulo: string;
    descricao: string | null;
    valor: number;
    solicitante_email: string;
    status: string;
    nivel_atual: number;
    niveis_necessarios: number;
    criado_em: string;
  }[] = [];
  let totalRegistros = 0;
  let totalPendentes = 0;
  let valorPendente = 0;

  if (!semClienteEscolhido && empresaSelecionada) {
    const offset = offsetDaPagina(POR_PAGINA, pageParam);
    const [{ data, count }, { data: pendentesRaw }] = await Promise.all([
      supabase
        .from("solicitacoes_aprovacao")
        .select(
          "id, categoria, titulo, descricao, valor, solicitante_email, status, nivel_atual, niveis_necessarios, criado_em",
          { count: "exact" }
        )
        .eq("empresa_id", empresaSelecionada)
        .order("criado_em", { ascending: false })
        .range(offset, offset + POR_PAGINA - 1),
      supabase.from("solicitacoes_aprovacao").select("valor").eq("empresa_id", empresaSelecionada).eq("status", "pendente"),
    ]);
    itens = data ?? [];
    totalRegistros = count ?? 0;
    const pendentes = pendentesRaw ?? [];
    totalPendentes = pendentes.length;
    valorPendente = pendentes.reduce((soma, p) => soma + (p.valor ?? 0), 0);
  }

  const { paginaAtual, totalPaginas } = calcularPaginacao(totalRegistros, POR_PAGINA, pageParam);

  // Fase Plano-Graficos Onda 1 (04/09/2026) — a tabela é paginada (20/pág),
  // então o gráfico usa uma amostra separada das 500 solicitações mais
  // recentes em vez da página atual só.
  let porStatus: ItemDistribuicao[] = [];
  let porCategoria: ItemDistribuicao[] = [];
  let valorPorCategoria: ItemValorCategoria[] = [];
  if (!semClienteEscolhido && empresaSelecionada) {
    const { data: amostraRaw } = await supabase
      .from("solicitacoes_aprovacao")
      .select("categoria, status, valor")
      .eq("empresa_id", empresaSelecionada)
      .order("criado_em", { ascending: false })
      .limit(500);
    const amostra = amostraRaw ?? [];

    const statusMap = new Map<string, number>();
    const categoriaMap = new Map<string, number>();
    const valorCategoriaMap = new Map<string, number>();
    for (const s of amostra) {
      const statusL = STATUS_LABEL[s.status] ?? s.status;
      const categoriaL = CATEGORIA_LABEL[s.categoria] ?? s.categoria;
      statusMap.set(statusL, (statusMap.get(statusL) ?? 0) + 1);
      categoriaMap.set(categoriaL, (categoriaMap.get(categoriaL) ?? 0) + 1);
      valorCategoriaMap.set(categoriaL, (valorCategoriaMap.get(categoriaL) ?? 0) + (s.valor ?? 0));
    }
    porStatus = [...statusMap.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
    porCategoria = [...categoriaMap.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
    valorPorCategoria = [...valorCategoriaMap.entries()]
      .map(([label, valor]) => ({ label, valor }))
      .filter((v) => v.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Aprovações</h1>
        <p className="mt-1 text-sm text-slate-500">
          Solicitação → aprovação → execução, com histórico — pra despesas de manutenção, frete ou peças que
          precisam de sign-off antes de gastar{nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}. Acima
          de R$ 2.000 exige 2 níveis de aprovação.
        </p>
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

      {semClienteEscolhido ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Selecione um cliente acima pra ver e criar solicitações de aprovação.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pendentes</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{totalPendentes}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valor pendente</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatarMoeda(valorPendente)}</p>
            </div>
          </div>

          <GraficoAprovacoes porStatus={porStatus} porCategoria={porCategoria} valorPorCategoria={valorPorCategoria} />

          {empresaSelecionada && (
            <NovaSolicitacaoForm
              empresaId={empresaSelecionada}
              categoriaInicial={categoriaParam}
              valorInicial={valorParam}
              tituloInicial={tituloParam}
            />
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Solicitação</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">Nível</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-slate-700">
                      <p className="font-medium">{s.titulo}</p>
                      {s.descricao && <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{s.descricao}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{CATEGORIA_LABEL[s.categoria] ?? s.categoria}</td>
                    <td className="px-4 py-3 text-slate-700">{formatarMoeda(s.valor)}</td>
                    <td className="px-4 py-3 text-slate-600">{s.solicitante_email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.nivel_atual}/{s.niveis_necessarios}
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[s.status] ?? "badge-inativo"}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatarDataHoraBr(s.criado_em)}</td>
                    <td className="px-4 py-3">
                      <AcoesSolicitacao id={s.id} status={s.status} />
                    </td>
                  </tr>
                ))}
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma solicitação de aprovação ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-4 pb-2">
              <Paginacao
                paginaAtual={paginaAtual}
                totalPaginas={totalPaginas}
                totalRegistros={totalRegistros}
                porPagina={POR_PAGINA}
                basePath="/aprovacoes"
                paramsAtuais={{ empresa: empresaParam }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
