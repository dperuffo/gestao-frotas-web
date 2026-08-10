// Fase automatiza-anp-bigquery, revisada na fase automatiza-anp-fonte-fixa
// (10/08/2026) — a ANP publica o "Levantamento de Preços de Combustíveis"
// num arquivo semanal cujo nome nem sempre segue o padrão esperado
// (resumo_semanal_lpc_{início}_{fim}.xlsx). Conferimos a listagem REAL de
// arquivos publicados em 2026 e achamos pelo menos 3 exceções: dois
// arquivos de abril com traço em vez de underscore entre as datas, um de
// março com sufixo "-1" (reemissão/correção). O mecanismo antigo
// (candidatosUrlSemanaAnp, adivinhava o nome por aritmética de data a
// partir de hoje) podia falhar silenciosamente nessas semanas mesmo com a
// rede 100% ok.
//
// A correção: em vez de ADIVINHAR o nome, LEMOS a listagem real que a ANP
// expõe (paginada, formato Plone) em
//   {BASE_ARQUIVOS}/{ano}/?b_start:int={0,20,40,...}
// extraímos os nomes de arquivo publicados de verdade (tolerando as
// variações acima) e escolhemos o de maior data-fim. Só então baixamos
// ESSE arquivo específico — pequeno (~300KB, 1 semana só), o mesmo formato
// que a importação manual já usa.
//
// Cogitamos também usar os arquivos ACUMULADOS de URL fixa que a ANP
// publica (semanal-estados-desde-2013.xlsx etc., sem nome pra adivinhar) —
// descartado porque são grandes demais (o de estados já passa de 12MB/114
// mil linhas) pro limite de memória de uma Edge Function, que é onde esse
// fetch roda hoje (ver route.ts do cron) por causa do bloqueio de rede
// Railway↔gov.br identificado na mesma investigação.
const BASE_ARQUIVOS =
  "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arquivos-lpc";

const USER_AGENT = "Mozilla/5.0 (compatible; FNI-cron/1.0)";
const TIMEOUT_LISTAGEM_MS = 20_000;
const TIMEOUT_DOWNLOAD_MS = 30_000;

type ArquivoAnp = { nome: string; inicio: string; fim: string; sufixo: number };

// Aceita tanto "resumo_semanal_lpc_2026-08-02_2026-08-08.xlsx" (padrão)
// quanto "resumo_semanal_lpc_2026-04-05-2026-04-11.xlsx" (traço, achado
// real em 2026) e sufixos de reemissão tipo "...-2026-03-14-1.xlsx".
function parseNomeArquivo(nome: string): ArquivoAnp | null {
  const m = nome.match(/resumo_semanal_lpc_(\d{4}-\d{2}-\d{2})[_-](\d{4}-\d{2}-\d{2})(?:-(\d+))?\.xlsx$/);
  if (!m) return null;
  return { nome, inicio: m[1], fim: m[2], sufixo: m[3] ? Number(m[3]) : 0 };
}

async function listarArquivosAno(ano: number): Promise<ArquivoAnp[]> {
  const vistos = new Map<string, ArquivoAnp>();
  // Cada página lista ~20 arquivos (paginação padrão do Plone/gov.br) — 15
  // páginas cobrem até 300 arquivos, bem mais que as ~52 semanas de um ano.
  for (let bStart = 0; bStart < 300; bStart += 20) {
    const url = `${BASE_ARQUIVOS}/${ano}/?b_start:int=${bStart}`;
    let html: string;
    try {
      const resposta = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_LISTAGEM_MS),
        headers: { "User-Agent": USER_AGENT },
      });
      if (!resposta.ok) break;
      html = await resposta.text();
    } catch {
      break;
    }

    const nomesDaPagina = [...html.matchAll(/resumo_semanal_lpc[^"]*\.xlsx/g)].map((m) => m[0]);
    if (nomesDaPagina.length === 0) break;

    let algumNovo = false;
    for (const nome of nomesDaPagina) {
      if (!vistos.has(nome)) {
        const parsed = parseNomeArquivo(nome);
        if (parsed) {
          vistos.set(nome, parsed);
          algumNovo = true;
        }
      }
    }
    // Página só repetiu arquivos já vistos (fim da listagem) — pra numa
    // página vazia/repetida em vez de continuar gastando requests à toa.
    if (bStart > 0 && !algumNovo) break;
  }
  return [...vistos.values()];
}

export type ResultadoBuscaAnp = {
  buffer: ArrayBuffer;
  urlEncontrada: string;
  semanaInicio: string;
  semanaFim: string;
};

// Descobre a URL do arquivo semanal mais recente lendo a listagem real da
// ANP (em vez de adivinhar por aritmética de data) e baixa esse arquivo.
export async function buscarPlanilhaAnpMaisRecente(referencia: Date = new Date()): Promise<ResultadoBuscaAnp> {
  const anoAtual = referencia.getUTCFullYear();
  let arquivos = await listarArquivosAno(anoAtual);
  if (arquivos.length === 0) {
    // Defensivo: início de janeiro, a pasta do ano novo podendo ainda não
    // ter nada listado por algum atraso da ANP — tenta o ano anterior.
    arquivos = await listarArquivosAno(anoAtual - 1);
  }
  if (arquivos.length === 0) {
    throw new Error(`Nenhum arquivo semanal encontrado na listagem da ANP (ano ${anoAtual}).`);
  }

  // Maior data-fim vence; em caso de empate (mesma semana reemitida),
  // maior sufixo vence (a reemissão mais recente).
  arquivos.sort((a, b) => (a.fim !== b.fim ? (a.fim < b.fim ? -1 : 1) : a.sufixo - b.sufixo));
  const maisRecente = arquivos[arquivos.length - 1];

  // A pasta é pelo ANO DO FIM da semana, não do início — confirmado
  // observando um arquivo real (semana 28/12/2025 a 03/01/2026) catalogado
  // na pasta "2026", não "2025".
  const anoPasta = maisRecente.fim.slice(0, 4);
  const url = `${BASE_ARQUIVOS}/${anoPasta}/${maisRecente.nome}`;

  const resposta = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_DOWNLOAD_MS),
    headers: { "User-Agent": USER_AGENT },
  });
  if (!resposta.ok) throw new Error(`${url} → HTTP ${resposta.status}`);
  const buffer = await resposta.arrayBuffer();
  if (buffer.byteLength < 1000) throw new Error(`${url} → resposta suspeita (${buffer.byteLength} bytes)`);

  return { buffer, urlEncontrada: url, semanaInicio: maisRecente.inicio, semanaFim: maisRecente.fim };
}
