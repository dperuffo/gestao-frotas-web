import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { segredoConfere } from "@/lib/segredoConstante";
import { verificarLimite, ipDaRequisicao, respostaLimiteExcedido } from "@/lib/rateLimit";
import { candidatosCondutorPorVinculoAcao, indicarCondutorLogica } from "@/lib/indicacaoCondutor";

// Auditoria de automação (13/09/2026, pedido do Daniel) — em /multas/[id] o
// sistema já pré-seleciona o motorista sugerido pelo vínculo Motorista<->
// Veículo ativo na data da infração (parametros_vinculo_motorista_veiculo),
// mas até aqui alguém precisava ABRIR a multa e clicar "Indicar Condutor"
// pra confirmar — mesmo quando só existe 1 candidato possível, sem
// ambiguidade nenhuma. Esse cron varre diariamente as multas pendentes de
// indicação e confirma sozinho os casos de candidato ÚNICO; 0 candidatos
// (sem vínculo cadastrado) ou 2+ candidatos (ambíguo) continuam exigindo
// decisão manual do gestor, exatamente como hoje.
//
// A lógica de busca de candidato(s) e de confirmação (checagem de grupo
// econômico + update em `multas`) mora em src/lib/indicacaoCondutor.ts e é a
// MESMA usada pelo clique manual em IndicarCondutorForm — só muda o client
// (aqui é admin/service role, sem sessão de usuário) e o autor gravado
// (indicado_por = rótulo do robô, indicado_automaticamente = true). Escolhido
// job periódico (varredura) em vez de gatilho no insert/import da multa
// porque não há um ponto único centralizado de criação (captura manual em
// criarMultaAcao, e futura integração Detran/Renainf ainda não existe) — a
// varredura é robusta a qualquer origem futura sem precisar tocar no fluxo
// de criação. Mesmo padrão de auth/rate limit de
// /api/cron/conciliacao-automatica.
export const runtime = "nodejs";
export const maxDuration = 60;

const AUTOR_LABEL_AUTOMATICO = "sistema (indicação automática — candidato único por vínculo)";

async function executar(request: Request) {
  const segredoEsperado = process.env.CRON_SECRET;
  if (!segredoEsperado) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado no servidor." }, { status: 500 });
  }
  const autorizacao = request.headers.get("authorization");
  if (!segredoConfere(autorizacao, `Bearer ${segredoEsperado}`)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const limite = verificarLimite(`cron-indicar-condutor-automatico:${ipDaRequisicao(request)}`, 20, 5 * 60 * 1000);
  if (!limite.permitido) return respostaLimiteExcedido(limite);

  const supabase = createAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: multasPendentes, error: erroBusca } = await supabase
    .from("multas")
    .select("id, placa, data_infracao, data_limite_indicacao")
    .is("motorista_id", null)
    .eq("status", "pendente_indicacao")
    .or(`data_limite_indicacao.is.null,data_limite_indicacao.gte.${hoje}`);

  if (erroBusca) {
    return NextResponse.json({ erro: `Falha ao buscar multas pendentes: ${erroBusca.message}` }, { status: 500 });
  }

  let avaliadas = 0;
  let indicadasAutomaticamente = 0;
  let ambiguas = 0;
  let semVinculo = 0;
  const erros: { multaId: string; erro: string }[] = [];

  for (const multa of multasPendentes ?? []) {
    avaliadas++;
    const candidatos = await candidatosCondutorPorVinculoAcao(supabase, multa.placa, multa.data_infracao);
    if (candidatos.length === 0) {
      semVinculo++;
      continue;
    }
    if (candidatos.length > 1) {
      ambiguas++;
      continue;
    }
    try {
      await indicarCondutorLogica(supabase, multa.id, candidatos[0], {
        autorLabel: AUTOR_LABEL_AUTOMATICO,
        automatico: true,
      });
      indicadasAutomaticamente++;
    } catch (e) {
      erros.push({ multaId: multa.id, erro: e instanceof Error ? e.message : "Falha desconhecida." });
    }
  }

  return NextResponse.json({
    avaliadas,
    indicadasAutomaticamente,
    ambiguas,
    semVinculo,
    erros,
  });
}

export async function GET(request: Request) {
  return executar(request);
}

export async function POST(request: Request) {
  return executar(request);
}
