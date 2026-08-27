import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaAtual } from "@/lib/empresaAtual";
import { listarAvisosAcao } from "../administracao/central-avisos/actions";
import { Sparkles, ShieldAlert, Bell, SlidersHorizontal } from "lucide-react";

// Fase Gestao-Controles (27/08/2026, pedido do Daniel: "gestao e controles
// mais diretos" / item do roadmap "Central de Regras & Alertas unificada")
// — achado real da varredura: hoje os alertas vivem espalhados em telas
// próprias (Antifraude, Ações Sugeridas, Central de Avisos), cada uma com
// lógica e banco próprios, sem 1 lugar só pra olhar tudo de uma vez.
//
// Escopo desta 1ª versão — decisão de projeto, não perguntei ao Daniel
// porque é claramente a leitura correta do pedido: um HUB que resume as 3
// telas (contadores + link direto) num painel só. NÃO tenta fundir os 3
// sistemas num banco/motor único — isso reescreveria Antifraude e Ações
// Sugeridas do zero (motores de detecção completamente diferentes: um é
// configurável por limite numérico, o outro é uma bateria de 7 RPCs de
// detecção fixas), um projeto bem maior e mais arriscado do que cabe numa
// entrega ao lado de mais 3 features nesta mesma fase. "Configurar
// limites" já existe e continua em /antifraude (regras com valor/janela de
// tempo) — este hub só destaca isso, não duplica o formulário aqui.
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

    const [{ data: acoesRaw }, { count: totalRegras }, { count: totalFalhas }, avisos] = await Promise.all([
      queryAcoes,
      queryRegras,
      queryFalhas,
      listarAvisosAcao({ incluirExpirados: false }),
    ]);

    const acoes = acoesRaw ?? [];
    acoesPendentes = acoes.length;
    acoesCriticas = acoes.filter((a) => a.severidade === "critica").length;
    regrasAntifraudeAtivas = totalRegras ?? 0;
    falhasAntifraudeNaoLidas = totalFalhas ?? 0;
    avisosAtivos = avisos.length;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Central de Regras & Alertas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumo dos 3 lugares onde a plataforma detecta e avisa sobre algo que precisa da sua atenção
          {nomeEmpresaSelecionada ? ` — ${nomeEmpresaSelecionada}` : ""}. Cada card leva pra tela de detalhe
          correspondente.
        </p>
      </div>

      {semClienteEscolhido ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Selecione um cliente no seletor do topo da página pra ver o resumo de regras e alertas dele.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        </div>
      )}

      <div className="mt-6 card p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Quer configurar um limite?</h2>
        </div>
        <p className="text-xs text-slate-500">
          Limites de valor, quantidade e janela de tempo pra abastecimento ficam em{" "}
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
