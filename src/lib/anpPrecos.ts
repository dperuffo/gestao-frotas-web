// Fase automatiza-anp-bigquery — parser da planilha oficial "Levantamento de
// Preços de Combustíveis" da ANP, extraído do Route Handler de importação
// manual (/api/inteligencia-rede/importar-precos-anp) pra ser reaproveitado
// também pela importação automática semanal (/api/cron/atualizar-precos-anp).
// As duas rotas usam exatamente essa mesma função — zero duplicação de
// lógica de parsing entre o caminho manual e o automático.
//
// Fase automatiza-anp-fonte-fixa (10/08/2026) — cogitamos, e chegamos a
// implementar, uma variante "acumulada" deste parser (pra ler os arquivos
// de URL fixa da ANP, sem nome pra adivinhar) — descartada por estourar o
// limite de memória da Edge Function onde o cron passou a rodar (arquivo
// de estados: 114 mil linhas / 12,5MB). A correção definitiva ficou em
// src/lib/anpFetch.ts: descobrir o nome real do arquivo semanal lendo a
// listagem da ANP, em vez de adivinhar por data — mantém esse parser
// original (arquivo pequeno, 1 semana só) como o único necessário.
import { lerAba, texto, numero, inteiro, data as celulaData, dedupePorChave } from "@/lib/xlsx";
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
