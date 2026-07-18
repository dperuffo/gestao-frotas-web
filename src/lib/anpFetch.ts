// Fase automatiza-anp-bigquery — a ANP publica o "Levantamento de Preços de
// Combustíveis (últimas semanas pesquisadas)" num link previsível, descoberto
// direto no site (não documentado em nenhuma API):
//
//   https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/
//   arquivos-lpc/{ano}/resumo_semanal_lpc_{domingo}_{sabado}.xlsx
//
// onde {domingo}/{sabado} são as datas (AAAA-MM-DD) do início/fim da semana
// da pesquisa (domingo a sábado). Confirmado manualmente em 18/07/2026: o
// arquivo da semana corrente (2026-07-12 a 2026-07-18) já existia no próprio
// sábado, então a ANP publica/atualiza esse arquivo ao longo da semana, não
// só depois dela fechar — por isso tentamos a semana atual primeiro e caímos
// pra semanas anteriores só se ela ainda não existir.
const BASE_URL =
  "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arquivos-lpc";

function formatarData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Dado um sábado de referência, devolve o domingo daquela mesma semana
// (6 dias antes).
function domingoDaSemana(sabado: Date): Date {
  const d = new Date(sabado);
  d.setUTCDate(d.getUTCDate() - 6);
  return d;
}

// Constrói a lista de URLs candidatas, da semana mais recente pra mais
// antiga, a partir de hoje. offsetMaximo=4 cobre um mês pra trás — mais que
// suficiente pra um job semanal que às vezes atrasa um pouco.
export function candidatosUrlSemanaAnp(referencia: Date = new Date(), offsetMaximo = 4): { url: string; inicio: string; fim: string }[] {
  const candidatos: { url: string; inicio: string; fim: string }[] = [];

  // Acha o sábado mais recente (hoje, se hoje já for sábado) — recuando
  // dia a dia a partir de hoje até cair num sábado.
  const sabado = new Date(referencia);
  while (sabado.getUTCDay() !== 6) {
    sabado.setUTCDate(sabado.getUTCDate() - 1);
  }

  for (let offset = 0; offset <= offsetMaximo; offset++) {
    const sabadoDaVez = new Date(sabado);
    sabadoDaVez.setUTCDate(sabadoDaVez.getUTCDate() - offset * 7);
    const domingoDaVez = domingoDaSemana(sabadoDaVez);
    const inicio = formatarData(domingoDaVez);
    const fim = formatarData(sabadoDaVez);
    const ano = domingoDaVez.getUTCFullYear();
    candidatos.push({
      url: `${BASE_URL}/${ano}/resumo_semanal_lpc_${inicio}_${fim}.xlsx`,
      inicio,
      fim,
    });
  }

  return candidatos;
}

export type ResultadoBuscaAnp = {
  buffer: ArrayBuffer;
  urlEncontrada: string;
  semanaInicio: string;
  semanaFim: string;
};

// Tenta baixar o arquivo da semana mais recente possível, caindo pras
// semanas anteriores em caso de 404 (arquivo da semana atual ainda não
// publicado). Lança erro se nenhum candidato responder.
export async function buscarPlanilhaAnpMaisRecente(referencia: Date = new Date()): Promise<ResultadoBuscaAnp> {
  const candidatos = candidatosUrlSemanaAnp(referencia);
  const falhas: string[] = [];

  for (const candidato of candidatos) {
    try {
      const resposta = await fetch(candidato.url, { cache: "no-store" });
      if (!resposta.ok) {
        falhas.push(`${candidato.url} → HTTP ${resposta.status}`);
        continue;
      }
      const buffer = await resposta.arrayBuffer();
      if (buffer.byteLength < 1000) {
        // Resposta "ok" mas claramente não é uma planilha de verdade.
        falhas.push(`${candidato.url} → resposta suspeita (${buffer.byteLength} bytes)`);
        continue;
      }
      return { buffer, urlEncontrada: candidato.url, semanaInicio: candidato.inicio, semanaFim: candidato.fim };
    } catch (e) {
      falhas.push(`${candidato.url} → ${e instanceof Error ? e.message : "erro de rede"}`);
    }
  }

  throw new Error(`Nenhuma planilha semanal da ANP encontrada. Tentativas:\n${falhas.join("\n")}`);
}
