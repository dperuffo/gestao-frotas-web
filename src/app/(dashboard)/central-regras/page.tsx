import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { listarAvisosAcao } from "../administracao/central-avisos/actions";
import { contarInsightsNovosAcao } from "../insights-ia/actions";
import { empresaTemAcessoInsightsIA } from "@/lib/acessoInsightsIA";
import { Sparkles, ShieldAlert, Bell, SlidersHorizontal, Brain } from "lucide-react";
import { GraficoCentralRegras, type ItemPendencia } from "./_components/GraficoCentralRegras";

// Fase Gestao-Controles (27/08/2026, pedido do Daniel: "gestao e controles
// mais diretos" / item do roadmap "Central de Regras & Alertas unificada")
// — achado real da varredura: hoje os alertas vivem espalhados em telas
// próprias (Antifraude, Ações Sugeridas, Central de Avisos), cada uma com
// lógica e banco próprios, sem 1 lugar só pra olhar tudo de uma vez.
//
// Escopo — decisão de projeto: um HUB que resume as 3 telas (contadores +
// link direto) num painel só. NÃO funde os 3 sistemas num banco/motor
// único — isso reescreveria Antifraude e Ações Sugeridas do zero (motores
// de detecção completamente diferentes; Central de Avisos nem é detecção,
// é broadcast/CMS), risco desproporcional ao valor.
//
// Fase Motor-de-Regras-Unico (27/08/2026, pedido do Daniel: "unificar em
// um motor de regras único") — o que ESSA parte do pedido pedia de
// verdade ("o gestor configura limites, não regra fixa no código") ganhou
// um lugar próprio de configuração em /central-regras/configuracoes: os
// limites numéricos que hoje ficam hardcoded dentro da detecção de
// anomalias (% acima do tanque, km/velocidade entre postos, dias parado,
// desvios-padrão de preço, mínimo de ocorrências) viraram configuráveis
// por empresa, com fallback pro comportamento de sempre pra quem não
// mexer em nada. "Configurar limites de valor/janela de tempo" pra
// abastecimento continua em /antifraude (é um sistema à parte, de
// pré-autorização — ver comentário na migration).
export default async function CentralRegrasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { empresa: empresaParam } = await searchParams;
  const supabase = await createClient();
  const { empresas, empresaSelecionada, nomeEmpresaSelecionada } = await resolverEmpresaAtual(supabase, empresaParam);
  const semClienteEscolhido = empresas.length > 1 && !empresaSelecionada;

  let acoesPendentes = 0;
  let acoesCriticas = 0;
  let regrasAntifraudeAtivas = 0;
  let falhasAntifraudeNaoLidas = 0;
  let avisosAtivos = 0;
  let insightsNovos = 0;
  let mostrarCardInsightsIA = false;

  if (!semClienteEscolhido) {
    let queryAcoes = supabase.from("acoes_sugeridas").select("severidade").eq("status", "pendente");
    if (empresaSelecionada) queryAcoes = queryAcoes.eq("empresa_id", empresaSelecionada);

    let queryRegras = supabase.from("regras_antifraude").select("id", { count: "exact", head: true }).eq("status", "Ativo");
    if (empresaSelecionada) queryRegras = queryRegras.eq("empresa_id", empresaSelecionada);

    let queryFalhas = supabase
      .from("antifraude_verificacoes_falhas")
      .select("id", { count: "exact", head: true })
      .is("lida_em", null);
    if (empresaSelecionada) queryFalhas = queryFalhas.eq("empresa_id", empresaSelecionada);

    // Fase IA-e-Automacao (27/08/2026, pedido do Daniel: "esta
    // funcionalidade só pode ser apresentada para os clientes com plano
    // enterprise") — card só aparece se a empresa selecionada for elegível
    // (mesma checagem usada pro menu/rota em layout.tsx — ver
    // src/lib/acessoInsightsIA.ts). Sem empresa selecionada (admin vendo
    // "todas"), assume elegível: o /insights-ia continua bloqueando por
    // trás pra quem não tiver acesso de verdade.
    const queryPlanoEmpresa = empresaSelecionada
      ? supabase.from("empresas").select("plano, acesso_insights_ia_liberado").eq("id", empresaSelecionada).single()
      : Promise.resolve({ data: null });

    const [{ data: acoesRaw }, { count: totalRegras }, { count: totalFalhas }, avisos, totalInsights, { data: empresaPlano }] =
      await Promise.all([
        queryAcoes,
        queryRegras,
        queryFalhas,
        listarAvisosAcao({ incluirExpirados: false }),
        contarInsightsNovosAcao(empresaSelecionada),
        queryPlanoEmpresa,
      ]);

    const acoes = acoesRaw ?? [];
    acoesPendentes = acoes.length;
    acoesCriticas = acoes.filter((a) => a.severidade === "critica").length;
    regrasAntifraudeAtivas = totalRegras ?? 0;
    falhasAntifraudeNaoLidas = totalFalhas ?? 0;
    avisosAtivos = avisos.length;
    insightsNovos = totalInsights;
    mostrarCardInsightsIA = !empresaSelecionada || (empresaPlano ? empresaTemAcessoInsightsIA(empresaPlano) : false);
  }

  // Fase Plano-Graficos Onda 2 (04/09/2026) — agregação do gráfico-resumo,
  // a partir dos contadores já calculados acima (sem query nova).
  const pendenciasPorSistema: ItemPendencia[] = [
    { label: "Ações Sugeridas", total: acoesPendentes },
    { label: "Antifraude (falhas)", total: falhasAntifraudeNaoLidas },
    { label: "Central de Avisos", total: avisosAtivos },
    ...(mostrarCardInsightsIA ? [{ label: "Insights de IA", total: insightsNovos }] : []),
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Central de Regras & Alertas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumo dos 4 lugares onde a plataforma detecta e avisa sobre algo que precisa da sua atenção
          {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}. Cada card leva pra tela de detalhe
          correspondente.
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
          Selecione um cliente acima pra ver o resumo de regras e alertas dele.
        </p>
      ) : (
        <>
        <GraficoCentralRegras dados={pendenciasPorSistema} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/acoes-sugeridas" className="card block p-5 transition hover:border-frota-200 hover:shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-frota-500" />
              <h2 className="text-sm font-semibold text-slate-900">Ações Sugeridas</h2>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Oportunidades detectadas automaticamente (CNH vencida, posto acima da média, hodômetro fora do padrão
              e outras) que ainda esperam sua decisão.
            </p>
            <div className="flex gap-4">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{acoesPendentes}</p>
                <p className="text-xs text-slate-500">Pendentes</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-red-600">{acoesCriticas}</p>
                <p className="text-xs text-slate-500">Críticas</p>
              </div>
            </div>
          </Link>

          <Link href="/antifraude" className="card block p-5 transition hover:border-frota-200 hover:shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-900">Antifraude</h2>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Regras de limite de valor/quantidade e janela de tempo que você configura pra bloquear abastecimento
              suspeito antes de autorizar.
            </p>
            <div className="flex gap-4">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{regrasAntifraudeAtivas}</p>
                <p className="text-xs text-slate-500">Regras ativas</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-amber-600">{falhasAntifraudeNaoLidas}</p>
                <p className="text-xs text-slate-500">Falhas não lidas</p>
              </div>
            </div>
          </Link>

          <Link href="/central-avisos" className="card block p-5 transition hover:border-frota-200 hover:shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-5 w-5 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-900">Central de Avisos</h2>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Novidades, correções e manutenções publicadas pela plataforma — canal oficial, sem depender de
              e-mail ou WhatsApp.
            </p>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{avisosAtivos}</p>
              <p className="text-xs text-slate-500">Ativos agora</p>
            </div>
          </Link>

          {mostrarCardInsightsIA && (
            <Link href="/insights-ia" className="card block p-5 transition hover:border-frota-200 hover:shadow-md">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-5 w-5 text-violet-600" />
                <h2 className="text-sm font-semibold text-slate-900">Insights de IA</h2>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Sinais cruzados entre combustível, manutenção, pneus, sinistros, multas, aprovações, seguro e
                motoristas — gerados 1x/dia, sem precisar perguntar.
              </p>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{insightsNovos}</p>
                <p className="text-xs text-slate-500">Novos</p>
              </div>
            </Link>
          )}
        </div>
        </>
      )}

      <div className="mt-6 card p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Quer configurar um limite?</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Os limites que a detecção de anomalias e ações sugeridas usa (% acima do tanque, distância entre postos,
          dias com hodômetro parado, e outros) ficam em{" "}
          <Link
            href={`/central-regras/configuracoes${empresaSelecionada ? `?empresa=${empresaSelecionada}` : ""}`}
            className="font-medium text-frota-600 hover:underline"
          >
            Configurar limites
          </Link>
          . Limites de valor, quantidade e janela de tempo pra abastecimento (pré-autorização, sistema à parte)
          ficam em{" "}
          <Link href="/antifraude" className="font-medium text-frota-600 hover:underline">
            Antifraude
          </Link>
          . Ligar/desligar o bloqueio automático de cada tipo de ação sugerida (ex.: bloquear motorista com CNH
          vencida sozinho, sem revisão manual) fica em{" "}
          <Link href="/acoes-sugeridas/restricoes" className="font-medium text-frota-600 hover:underline">
            Restrições automáticas
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
