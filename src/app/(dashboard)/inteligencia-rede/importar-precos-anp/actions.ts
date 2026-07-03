"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerAba, texto, numero, inteiro, data as celulaData, dedupePorChave } from "@/lib/xlsx";
import type { Database } from "@/types/database.types";

export type ResultadoImportacaoPrecosAnp =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; porNivel: Record<string, number>; duplicadas: number };

type LinhaRef = Database["public"]["Tables"]["anp_precos_referencia"]["Insert"];
type Nivel = LinhaRef["nivel"];

// O relatório oficial da ANP ("Levantamento de Preços de Combustíveis") vem
// em 5 abas com o mesmo bloco de 9 linhas de cabeçalho institucional antes
// da tabela de fato (linha de título das colunas no índice 9, dados a
// partir do índice 10). Cada aba tem um recorte geográfico diferente.
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
  {
    aba: "BRASIL",
    nivel: "brasil",
    colProduto: 3,
    colNumPostos: 4,
    colUnidade: 5,
    colPrecoMedio: 6,
    colDesvioPadrao: 7,
    colPrecoMinimo: 8,
    colPrecoMaximo: 9,
    colCoefVariacao: 10,
  },
  {
    aba: "REGIOES",
    nivel: "regiao",
    colRegiao: 2,
    colProduto: 3,
    colNumPostos: 4,
    colUnidade: 5,
    colPrecoMedio: 6,
    colDesvioPadrao: 7,
    colPrecoMinimo: 8,
    colPrecoMaximo: 9,
    colCoefVariacao: 10,
  },
  {
    aba: "ESTADOS",
    nivel: "estado",
    colRegiao: 2,
    colEstado: 3,
    colProduto: 4,
    colNumPostos: 5,
    colUnidade: 6,
    colPrecoMedio: 7,
    colDesvioPadrao: 8,
    colPrecoMinimo: 9,
    colPrecoMaximo: 10,
    colCoefVariacao: 11,
  },
  {
    aba: "MUNICIPIOS",
    nivel: "municipio",
    colEstado: 2,
    colMunicipio: 3,
    colProduto: 4,
    colNumPostos: 5,
    colUnidade: 6,
    colPrecoMedio: 7,
    colDesvioPadrao: 8,
    colPrecoMinimo: 9,
    colPrecoMaximo: 10,
    colCoefVariacao: 11,
  },
  {
    aba: "CAPITAIS",
    nivel: "capital",
    colEstado: 2,
    colMunicipio: 3,
    colProduto: 4,
    colNumPostos: 5,
    colUnidade: 6,
    colPrecoMedio: 7,
    colDesvioPadrao: 8,
    colPrecoMinimo: 9,
    colPrecoMaximo: 10,
    colCoefVariacao: 11,
  },
];

const LINHA_CABECALHO = 9; // 0-based: linha 10 da planilha
const LINHA_INICIO_DADOS = 10;

export async function importarPrecosAnp(
  _prev: ResultadoImportacaoPrecosAnp | undefined,
  formData: FormData
): Promise<ResultadoImportacaoPrecosAnp> {
  const supabase = await createClient();

  const { data: perfil } = await supabase.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    return { erro: "Apenas administradores podem importar a série de preços oficiais da ANP." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione o arquivo precos_anp.xlsx." };
  }

  const buffer = await arquivo.arrayBuffer();
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

  if (registros.length === 0) {
    return {
      erro: "Nenhuma linha válida encontrada. Confira se o arquivo tem as abas BRASIL, REGIOES, ESTADOS, MUNICIPIOS e CAPITAIS.",
    };
  }

  const registrosSemDuplicata = dedupePorChave(
    registros,
    (r) => `${r.nivel}__${r.data_inicial}__${r.data_final}__${r.regiao}__${r.estado}__${r.municipio}__${r.produto}`
  );
  const duplicadas = registros.length - registrosSemDuplicata.length;

  let sucesso = 0;
  const tamanhoLote = 500;
  for (let i = 0; i < registrosSemDuplicata.length; i += tamanhoLote) {
    const lote = registrosSemDuplicata.slice(i, i + tamanhoLote);
    const { error } = await supabase
      .from("anp_precos_referencia")
      .upsert(lote, { onConflict: "nivel,data_inicial,data_final,regiao,estado,municipio,produto" });
    if (error) {
      return { erro: `Falha ao gravar: ${error.message}. Lotes anteriores já foram mantidos.` };
    }
    sucesso += lote.length;
  }

  revalidatePath("/inteligencia-rede");

  return { total: registros.length + erros, sucesso, erros, porNivel, duplicadas };
}
