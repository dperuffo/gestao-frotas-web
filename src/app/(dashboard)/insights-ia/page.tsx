import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { listarInsightsAcao } from "./actions";
import { CardInsightIA } from "./_components/CardInsightIA";
import { formatarMoeda } from "@/lib/financeiro";
import { GraficoInsightsIA, type ItemDistribuicao, type ItemImpactoCategoria } from "./_components/GraficoInsightsIA";

const ORDEM_SEVERIDADE: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

// Fase IA-e-Automacao (27/08/2026, pedido do Daniel: "implementar o quinto e
// ultimo item das acoes de melhorias mapeadas - IA e Automação... abranger,
// ao máximo, insights com dados e informações das milhares de operações já
// realizadas... que agregam alto valor ao negócio e se diferencia das
// outras plataformas de TMS") — item do roadmap "Assistente FNI proativo".
//
// Decisão de arquitetura (confirmada com o Daniel): job diário (cron
// /api/cron/gerar-insights-ia) gera o conteúdo — esta tela só EXIBE o que já
// foi calculado e redigido, sem chamar IA na hora (custo previsível). O
// dado por trás de cada insight é 100% SQL real (ver
// coletar_sinais_insights_ia); o Claude só prioriza e redige o texto — ver
// src/lib/insightsIA.ts pro racional completo.
export default async function InsightsIAPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  const insights = semClienteEscolhido || !empresaSelecionada ? [] : await listarInsightsAcao(empresaSelecionada);

  const ordenados = [...insights].sort((a, b) => {
    if (a.status === "novo" && b.status !== "novo") return -1;
    if (a.status !== "novo" && b.status === "novo") return 1;
    const sevDiff = (ORDEM_SEVERIDADE[a.severidade] ?? 9) - (ORDEM_SEVERIDADE[b.severidade] ?? 9);
    if (sevDiff !== 0) return sevDiff;
    return (b.valor_impacto_estimado ?? 0) - (a.valor_impacto_estimado ?? 0);
  });

  const novos = insights.filter((i) => i.status === "novo");
  const valorTotalNovos = novos.reduce((soma, i) => soma + (i.valor_impacto_estimado ?? 0), 0);

  // Fase Plano-Graficos Onda 2 (04/09/2026) — agregações do gráfico, a
  // partir do insights já carregado (sem query nova).
  const SEVERIDADE_LABEL: Record<string, string> = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };
  const severidadeMap = new Map<string, number>();
  const impactoCategoriaMap = new Map<string, number>();
  for (const i of novos) {
    const sevL = SEVERIDADE_LABEL[i.severidade] ?? i.severidade;
    severidadeMap.set(sevL, (severidadeMap.get(sevL) ?? 0) + 1);
    if (i.valor_impacto_estimado) {
      impactoCategoriaMap.set(i.categoria, (impactoCategoriaMap.get(i.categoria) ?? 0) + i.valor_impacto_estimado);
    }
  }
  const porSeveridade: ItemDistribuicao[] = ["Crítica", "Alta", "Média", "Baixa"]
    .map((label) => ({ label, total: severidadeMap.get(label) ?? 0 }))
    .filter((d) => d.total > 0);
  const impactoPorCategoria: ItemImpactoCategoria[] = [...impactoCategoriaMap.entries()]
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Insights Proativos de IA</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sinais reais encontrados nas milhares de operações já registradas — combustível, manutenção, pneus,
          sinistros, multas, aprovações, seguro e motoristas cruzados de uma vez, sem você precisar perguntar{" "}
          {nomeEmpresaSelecionada ? `— ${nomeEmpresaSelecionada}` : ""}. Atualizado 1x por dia.
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
          Selecione um cliente acima pra ver os insights dele.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Novos</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{novos.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Impacto estimado (novos)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatarMoeda(valorTotalNovos)}</p>
            </div>
          </div>

          <GraficoInsightsIA porSeveridade={porSeveridade} impactoPorCategoria={impactoPorCategoria} />

          <div className="space-y-3">
            {ordenados.map((insight) => (
              <CardInsightIA key={insight.id} insight={insight} />
            ))}
            {ordenados.length === 0 && (
              <p className="card p-8 text-center text-sm text-slate-400">
                Nenhum insight no momento — o job diário revisa a operação todo dia e só mostra aqui o que realmente
                valer a pena.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
