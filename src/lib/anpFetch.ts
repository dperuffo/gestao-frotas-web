// Fase automatiza-anp-bigquery — a ANP publica o "Levantamento de Preços de
// Combustíveis" também em arquivos ACUMULADOS de URL FIXA (nunca mudam de
// nome), atualizados no mesmo lugar toda semana com a pesquisa mais recente
// — descobertos em 10/08/2026 investigando uma alternativa ao mecanismo
// antigo (removido nesta fase), que "adivinhava" o nome do arquivo semanal
// por aritmética de data (resumo_semanal_lpc_{domingo}_{sabado}.xlsx).
//
// Motivo da troca: o nome do arquivo semanal nem sempre segue esse padrão —
// conferimos a listagem real de arquivos publicados em 2026 e achamos pelo
// menos 3 exceções (dois arquivos de abril com traço em vez de underscore
// entre as datas, um de março com sufixo "-1" de reemissão). Ou seja, o
// "chute" podia falhar mesmo com a rede 100% ok. As URLs fixas abaixo
// eliminam esse problema por completo: nunca precisam ser adivinhadas, só
// filtramos a semana mais recente de dentro de cada arquivo (que carrega o
// histórico inteiro desde 2013, ~1 arquivo por nível geográfico).
//
// Ressalva: essas URLs continuam em www.gov.br — não resolvem sozinhas o
// bloqueio de rede Railway↔gov.br identificado em 10/08/2026 (ver
// route.ts do cron). São uma correção de robustez independente disso.
const BASE_SHLP =
  "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/shlp";

export type NivelAcumuladoAnp = "brasil" | "regiao" | "estado" | "municipio";

// O arquivo de município é o único que troca de nome (1x por ano, rodando
// por ano civil — provavelmente pra não crescer sem limite: só ele já
// tinha 72 mil linhas em 7 meses de 2026). É o único ponto que ainda
// "adivinha" algo, mas só o ano corrente — risco bem menor que adivinhar
// toda semana como no mecanismo antigo.
export function urlsAcumuladasAnp(referencia: Date = new Date()): { nivel: NivelAcumuladoAnp; url: string }[] {
  const ano = referencia.getUTCFullYear();
  return [
    { nivel: "brasil", url: `${BASE_SHLP}/semanal/semanal-brasil-desde-2013.xlsx` },
    { nivel: "regiao", url: `${BASE_SHLP}/semanal/semanal-regioes-desde-2013.xlsx` },
    { nivel: "estado", url: `${BASE_SHLP}/semanal/semanal-estados-desde-2013.xlsx` },
    { nivel: "municipio", url: `${BASE_SHLP}/semanal/semanal-municipios-${ano}.xlsx` },
  ];
}

export type BuffersAcumuladosAnp = Record<NivelAcumuladoAnp, ArrayBuffer>;

// Timeout bem maior que o do mecanismo antigo (15s) — esses arquivos
// carregam o histórico inteiro desde 2013 e já passam de 12MB (estados),
// crescendo ~1MB/ano. Um timeout curto demais confundiria "arquivo grande,
// mas rede ok" com o cenário de rede travada que motivou o
// AbortSignal.timeout em primeiro lugar (achado de 27/07/2026, ver
// route.ts do cron) — o objetivo do timeout é falhar rápido quando a
// resposta realmente nunca vem, não punir arquivos legitimamente grandes.
const TIMEOUT_FETCH_ANP_MS = 60_000;

async function baixar(url: string): Promise<ArrayBuffer> {
  const resposta = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_FETCH_ANP_MS) });
  if (!resposta.ok) throw new Error(`${url} → HTTP ${resposta.status}`);
  const buffer = await resposta.arrayBuffer();
  if (buffer.byteLength < 1000) {
    // Resposta "ok" mas claramente não é uma planilha de verdade.
    throw new Error(`${url} → resposta suspeita (${buffer.byteLength} bytes)`);
  }
  return buffer;
}

// Baixa os 4 arquivos acumulados em paralelo. Diferente do mecanismo
// antigo (que caía pra semana anterior em caso de falha pontual), aqui uma
// falha em qualquer um dos 4 aborta a atualização inteira — os 4 níveis
// vêm sempre juntos da mesma semana, então gravar só 3 deles deixaria a
// tabela inconsistente entre níveis pra semana corrente.
export async function buscarPlanilhasAnpAcumuladas(referencia: Date = new Date()): Promise<BuffersAcumuladosAnp> {
  const alvos = urlsAcumuladasAnp(referencia);
  const resultados = await Promise.allSettled(alvos.map((alvo) => baixar(alvo.url)));

  const falhas: string[] = [];
  const buffers = {} as BuffersAcumuladosAnp;
  resultados.forEach((resultado, i) => {
    if (resultado.status === "fulfilled") {
      buffers[alvos[i].nivel] = resultado.value;
    } else {
      const motivo = resultado.reason instanceof Error ? resultado.reason.message : "erro de rede";
      falhas.push(`${alvos[i].url} → ${motivo}`);
    }
  });

  if (falhas.length > 0) {
    throw new Error(`Falha ao baixar planilha(s) acumuladas da ANP:\n${falhas.join("\n")}`);
  }
  return buffers;
}
