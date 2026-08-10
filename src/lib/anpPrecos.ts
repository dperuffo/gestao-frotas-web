// Fase automatiza-anp-bigquery — parser da planilha oficial "Levantamento de
// Preços de Combustíveis" da ANP, extraído do Route Handler de importação
// manual (/api/inteligencia-rede/importar-precos-anp) pra ser reaproveitado
// também pela importação automática semanal (/api/cron/atualizar-precos-anp).
// As duas rotas usam exatamente essa mesma função — zero duplicação de
// lógica de parsing entre o caminho manual e o automático.
import { lerAba, texto, numero, inteiro, data as celulaData, dedupePorChave, indiceColunas, normalizarCabecalho } from "@/lib/xlsx";
import type { Database } from "@/types/database.types";

type LinhaRef = Database["public"]["Tables"]["anp_precos_referencia"]["Insert"];
type Nivel = LinhaRef["nivel"];

type ConfigAba = {
  aba: string;
  nivel: Nivel;
  colRegiao?: number;
  colEstado?: number;
  colMunicipio?: number;
  colProduto: number;
  colNumPostos: number;
  colUnidade: number;
  colPrecoMedio: number;
  colDesvioPadrao: number;
  colPrecoMinimo: number;
  colPrecoMaximo: number;
  colCoefVariacao: number;
};

const ABAS: ConfigAba[] = [
  { aba: "BRASIL", nivel: "brasil", colProduto: 3, colNumPostos: 4, colUnidade: 5, colPrecoMedio: 6, colDesvioPadrao: 7, colPrecoMinimo: 8, colPrecoMaximo: 9, colCoefVariacao: 10 },
  { aba: "REGIOES", nivel: "regiao", colRegiao: 2, colProduto: 3, colNumPostos: 4, colUnidade: 5, colPrecoMedio: 6, colDesvioPadrao: 7, colPrecoMinimo: 8, colPrecoMaximo: 9, colCoefVariacao: 10 },
  { aba: "ESTADOS", nivel: "estado", colRegiao: 2, colEstado: 3, colProduto: 4, colNumPostos: 5, colUnidade: 6, colPrecoMedio: 7, colDesvioPadrao: 8, colPrecoMinimo: 9, colPrecoMaximo: 10, colCoefVariacao: 11 },
  { aba: "MUNICIPIOS", nivel: "municipio", colEstado: 2, colMunicipio: 3, colProduto: 4, colNumPostos: 5, colUnidade: 6, colPrecoMedio: 7, colDesvioPadrao: 8, colPrecoMinimo: 9, colPrecoMaximo: 10, colCoefVariacao: 11 },
  { aba: "CAPITAIS", nivel: "capital", colEstado: 2, colMunicipio: 3, colProduto: 4, colNumPostos: 5, colUnidade: 6, colPrecoMedio: 7, colDesvioPadrao: 8, colPrecoMinimo: 9, colPrecoMaximo: 10, colCoefVariacao: 11 },
];

const LINHA_CABECALHO = 9; // 0-based: linha 10 da planilha
const LINHA_INICIO_DADOS = 10;

export type ResultadoParseAnpPrecos = {
  registros: LinhaRef[];
  totalAntesDedupe: number;
  duplicadas: number;
  erros: number;
  porNivel: Record<string, number>;
};

// Parser do formato "manual" — planilha de UMA semana só, com 5 abas fixas
// (BRASIL/REGIOES/ESTADOS/MUNICIPIOS/CAPITAIS), cabeçalho sempre na linha
// 10. É o formato que a ANP publica em
// .../arquivos-lpc/{ano}/resumo_semanal_lpc_{inicio}_{fim}.xlsx e que um
// admin baixa e sobe manualmente pela tela /inteligencia-rede/importar-
// precos-anp. Usado só por essa rota manual — o cron semanal usa
// parseAnpPrecosAcumulado (abaixo) desde a fase automatiza-anp-fonte-fixa.
export function parseAnpPrecosXlsx(buffer: ArrayBuffer): ResultadoParseAnpPrecos {
  const registros: LinhaRef[] = [];
  let erros = 0;
  const porNivel: Record<string, number> = {};

  for (const config of ABAS) {
    const linhas = lerAba(buffer, config.aba);
    if (linhas.length <= LINHA_INICIO_DADOS) continue;

    const cabecalho = texto(linhas[LINHA_CABECALHO]?.[0] ?? "").toLowerCase();
    if (!cabecalho.includes("data")) {
      erros++;
      continue;
    }

    for (let i = LINHA_INICIO_DADOS; i < linhas.length; i++) {
      const linha = linhas[i];
      if (!linha || linha.every((c) => c === null || c === "")) continue;

      const dataInicial = celulaData(linha[0]);
      const dataFinal = celulaData(linha[1]);
      const produto = texto(linha[config.colProduto]);
      const precoMedio = numero(linha[config.colPrecoMedio]);

      if (!dataInicial || !dataFinal || !produto || precoMedio === null) {
        erros++;
        continue;
      }

      registros.push({
        nivel: config.nivel,
        data_inicial: dataInicial,
        data_final: dataFinal,
        regiao: config.colRegiao !== undefined ? texto(linha[config.colRegiao]) : "",
        estado: config.colEstado !== undefined ? texto(linha[config.colEstado]) : "",
        municipio: config.colMunicipio !== undefined ? texto(linha[config.colMunicipio]) : "",
        produto,
        num_postos_pesquisados: inteiro(linha[config.colNumPostos]),
        unidade_medida: texto(linha[config.colUnidade]) || null,
        preco_medio: precoMedio,
        desvio_padrao: numero(linha[config.colDesvioPadrao]),
        preco_minimo: numero(linha[config.colPrecoMinimo]),
        preco_maximo: numero(linha[config.colPrecoMaximo]),
        coef_variacao: numero(linha[config.colCoefVariacao]),
      });
      porNivel[config.nivel] = (porNivel[config.nivel] ?? 0) + 1;
    }
  }

  const registrosSemDuplicata = dedupePorChave(
    registros,
    (r) => `${r.nivel}__${r.data_inicial}__${r.data_final}__${r.regiao}__${r.estado}__${r.municipio}__${r.produto}`
  );

  return {
    registros: registrosSemDuplicata,
    totalAntesDedupe: registros.length,
    duplicadas: registros.length - registrosSemDuplicata.length,
    erros,
    porNivel,
  };
}

// ---------------------------------------------------------------------
// Fase automatiza-anp-fonte-fixa (10/08/2026) — parser do formato
// "acumulado", usado pelo cron semanal (ver src/lib/anpFetch.ts pro porquê
// da troca). São 4 arquivos separados (1 por nível geográfico, sem
// CAPITAIS — deriva-se filtrando o de município pelas 27 capitais), cada
// um com 1 aba só carregando o histórico inteiro desde 2013 (ou desde
// jan/{ano} no caso de município). Duas diferenças estruturais do formato
// manual que nos obrigam a um parser à parte em vez de só trocar a fonte:
//   1. Cabeçalho NÃO está sempre na mesma linha (11 nesse formato pro
//      arquivo de município, 17 pros de brasil/região/estado — variam
//      conforme quantos parágrafos de nota histórica o arquivo acumulou).
//      Por isso aqui a linha de cabeçalho é DESCOBERTA procurando a célula
//      "DATA INICIAL", em vez de um número fixo — mais robusto a qualquer
//      mudança futura no preâmbulo.
//   2. As colunas têm uma a mais (MARGEM MÉDIA REVENDA, que ignoramos —
//      não existe campo correspondente em anp_precos_referencia) e não
//      necessariamente na mesma ordem/posição do formato manual. Por isso
//      aqui mapeamos colunas pelo NOME normalizado (via indiceColunas, o
//      mesmo utilitário que os outros importadores da app já usam pra não
//      depender de ordem de coluna) em vez de índice fixo.
// Cada arquivo acumulado carrega anos de histórico — manter tudo geraria
// upserts enormes e desnecessários toda semana (a linha já existe desde a
// semana em que foi publicada). Por isso filtramos, PARA CADA nível
// separadamente, só as linhas cuja data_final é a mais recente encontrada
// naquele arquivo — replica exatamente o volume de dados que o formato
// manual (1 semana só) sempre entregou.
const CAPITAL_POR_ESTADO: Record<string, string> = {
  ACRE: "RIO BRANCO",
  ALAGOAS: "MACEIO",
  AMAPA: "MACAPA",
  AMAZONAS: "MANAUS",
  BAHIA: "SALVADOR",
  CEARA: "FORTALEZA",
  "DISTRITO FEDERAL": "BRASILIA",
  "ESPIRITO SANTO": "VITORIA",
  GOIAS: "GOIANIA",
  MARANHAO: "SAO LUIS",
  "MATO GROSSO": "CUIABA",
  "MATO GROSSO DO SUL": "CAMPO GRANDE",
  "MINAS GERAIS": "BELO HORIZONTE",
  PARA: "BELEM",
  PARAIBA: "JOAO PESSOA",
  PARANA: "CURITIBA",
  PERNAMBUCO: "RECIFE",
  PIAUI: "TERESINA",
  "RIO DE JANEIRO": "RIO DE JANEIRO",
  "RIO GRANDE DO NORTE": "NATAL",
  "RIO GRANDE DO SUL": "PORTO ALEGRE",
  RONDONIA: "PORTO VELHO",
  RORAIMA: "BOA VISTA",
  "SANTA CATARINA": "FLORIANOPOLIS",
  "SAO PAULO": "SAO PAULO",
  SERGIPE: "ARACAJU",
  TOCANTINS: "PALMAS",
};

function encontrarLinhaCabecalho(linhas: unknown[][]): number {
  for (let i = 0; i < Math.min(linhas.length, 40); i++) {
    if (normalizarCabecalho(linhas[i]?.[0]) === "data inicial") return i;
  }
  return -1;
}

// Faz o parse de UM arquivo acumulado (1 nível geográfico), já filtrando
// só a semana mais recente encontrada nele.
function parseArquivoAcumulado(buffer: ArrayBuffer, nivel: Nivel): { registros: LinhaRef[]; erros: number } {
  const linhas = lerAba(buffer); // arquivo tem 1 aba só, usa a primeira
  const erros = 0;
  const linhaCabecalho = encontrarLinhaCabecalho(linhas);
  if (linhaCabecalho === -1) {
    return { registros: [], erros: 1 };
  }

  const indice = indiceColunas(linhas[linhaCabecalho]);
  const idx = {
    dataInicial: indice.get("data inicial"),
    dataFinal: indice.get("data final"),
    regiao: indice.get("regiao"),
    estado: indice.get("estado"),
    municipio: indice.get("municipio"),
    produto: indice.get("produto"),
    numPostos: indice.get("numero de postos pesquisados"),
    unidade: indice.get("unidade de medida"),
    precoMedio: indice.get("preco medio revenda"),
    desvioPadrao: indice.get("desvio padrao revenda"),
    precoMinimo: indice.get("preco minimo revenda"),
    precoMaximo: indice.get("preco maximo revenda"),
    coefVariacao: indice.get("coef de variacao revenda"),
  };
  if (idx.dataInicial === undefined || idx.dataFinal === undefined || idx.produto === undefined || idx.precoMedio === undefined) {
    // Cabeçalho mudou de vez (nome de coluna essencial sumiu) — melhor
    // falhar alto e visível do que gravar dados errados silenciosamente.
    return { registros: [], erros: 1 };
  }

  type Bruta = LinhaRef & { __erro?: boolean };
  const brutas: Bruta[] = [];
  for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha || linha.every((c) => c === null || c === "")) continue;

    const dataInicial = celulaData(linha[idx.dataInicial]);
    const dataFinal = celulaData(linha[idx.dataFinal]);
    const produto = texto(linha[idx.produto]);
    const precoMedio = numero(linha[idx.precoMedio]);
    if (!dataInicial || !dataFinal || !produto || precoMedio === null) {
      brutas.push({ __erro: true } as Bruta);
      continue;
    }

    brutas.push({
      nivel,
      data_inicial: dataInicial,
      data_final: dataFinal,
      regiao: idx.regiao !== undefined ? texto(linha[idx.regiao]) : "",
      estado: idx.estado !== undefined ? texto(linha[idx.estado]) : "",
      municipio: idx.municipio !== undefined ? texto(linha[idx.municipio]) : "",
      produto,
      num_postos_pesquisados: idx.numPostos !== undefined ? inteiro(linha[idx.numPostos]) : null,
      unidade_medida: idx.unidade !== undefined ? texto(linha[idx.unidade]) || null : null,
      preco_medio: precoMedio,
      desvio_padrao: idx.desvioPadrao !== undefined ? numero(linha[idx.desvioPadrao]) : null,
      preco_minimo: idx.precoMinimo !== undefined ? numero(linha[idx.precoMinimo]) : null,
      preco_maximo: idx.precoMaximo !== undefined ? numero(linha[idx.precoMaximo]) : null,
      coef_variacao: idx.coefVariacao !== undefined ? numero(linha[idx.coefVariacao]) : null,
    });
  }

  const validas = brutas.filter((r) => !r.__erro);
  const totalErros = erros + (brutas.length - validas.length);
  if (validas.length === 0) return { registros: [], erros: totalErros };

  // A semana mais recente é a de maior data_final (o arquivo vem em ordem
  // cronológica crescente, mas não confiamos nisso — comparamos direto).
  const maxDataFinal = validas.reduce((max, r) => (r.data_final! > max ? r.data_final! : max), validas[0].data_final!);
  const daSemanaAtual = validas.filter((r) => r.data_final === maxDataFinal);

  return { registros: daSemanaAtual, erros: totalErros };
}

export function parseAnpPrecosAcumulado(buffers: Record<"brasil" | "regiao" | "estado" | "municipio", ArrayBuffer>): ResultadoParseAnpPrecos {
  const registros: LinhaRef[] = [];
  let erros = 0;
  const porNivel: Record<string, number> = {};

  const brasil = parseArquivoAcumulado(buffers.brasil, "brasil");
  const regiao = parseArquivoAcumulado(buffers.regiao, "regiao");
  const estado = parseArquivoAcumulado(buffers.estado, "estado");
  const municipio = parseArquivoAcumulado(buffers.municipio, "municipio");
  erros += brasil.erros + regiao.erros + estado.erros + municipio.erros;

  for (const r of [...brasil.registros, ...regiao.registros, ...estado.registros, ...municipio.registros]) {
    registros.push(r);
    porNivel[r.nivel] = (porNivel[r.nivel] ?? 0) + 1;
  }

  // "Capital" não existe como arquivo próprio nesse formato — deriva do de
  // município, filtrando pela cidade que é capital de cada estado (mesma
  // ideia que a aba CAPITAIS do formato manual já representava).
  for (const r of municipio.registros) {
    const capital = CAPITAL_POR_ESTADO[r.estado ?? ""];
    if (capital && r.municipio === capital) {
      registros.push({ ...r, nivel: "capital" });
      porNivel.capital = (porNivel.capital ?? 0) + 1;
    }
  }

  const registrosSemDuplicata = dedupePorChave(
    registros,
    (r) => `${r.nivel}__${r.data_inicial}__${r.data_final}__${r.regiao}__${r.estado}__${r.municipio}__${r.produto}`
  );

  return {
    registros: registrosSemDuplicata,
    totalAntesDedupe: registros.length,
    duplicadas: registros.length - registrosSemDuplicata.length,
    erros,
    porNivel,
  };
}
