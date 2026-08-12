"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerPlanilhaComoTexto } from "@/lib/xlsx";
import { normalizarCNPJ } from "@/lib/utils";
import { CLASSIFICACAO, type Classificacao } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type VeiculoInsert = Database["public"]["Tables"]["cadastro_veiculos"]["Insert"];
type VeiculoUpdate = Database["public"]["Tables"]["cadastro_veiculos"]["Update"];

export type LinhaResultado = {
  linha: number;
  identificacao: string;
  status: "ok" | "erro";
  mensagem: string;
};

export type ResultadoImportacao =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; linhas: LinhaResultado[] };

const COLUNAS_OBRIGATORIAS = ["placa", "cnpj_cliente"];

function numeroOuNull(valor: string) {
  const texto = valor.trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Fase Corrige-Reimportação-Veículos (12/08/2026, achado real do Daniel): a
// planilha de importação em lote também é usada como atalho pra EDITAR
// veículos já cadastrados (baixa o modelo/exporta, ajusta os dados de vários
// veículos numa tabela só, reenvia) -- só que o import era insert-only, e
// qualquer linha cujo placa+cliente já existisse virava erro de
// duplicidade. Pior: existem DOIS índices únicos cobrindo isso
// (cadastro_veiculos_cnpj_frota_placa_key, sobre o texto puro, e
// cadastro_veiculos_cnpj_placa_norm_uidx, sobre o texto normalizado --
// maiúsculo, sem pontuação), então nem dava pra resolver só com um
// .upsert(onConflict: ...) do PostgREST, que só mira UM constraint por vez
// e não pega o outro.
//
// Solução: buscar os veículos já cadastrados do(s) cliente(s) envolvidos,
// casar cada linha da planilha contra eles usando a MESMA normalização do
// norm_uidx, e decidir update x insert por linha. O update é PARCIAL --
// só sobrescreve o campo que veio preenchido na planilha; célula em branco
// não apaga o que já estava cadastrado (community/ERP convention: em
// branco = "não mexer", não "limpar"). Isso deixa o usuário reexportar,
// ajustar só as colunas que quer mudar e reimportar sem medo de perder
// dado que não tocou.
function normalizarChave(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export async function importarVeiculos(
  _prev: ResultadoImportacao | undefined,
  formData: FormData
): Promise<ResultadoImportacao> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo Excel (.xlsx) para importar." };
  }

  const buffer = await arquivo.arrayBuffer();
  const linhas = lerPlanilhaComoTexto(buffer);
  if (linhas.length < 2) {
    return { erro: "O arquivo está vazio ou não tem nenhuma linha de dados." };
  }

  const cabecalho = linhas[0].map((c) => c.trim().toLowerCase());
  const indice = (nomeColuna: string) => cabecalho.indexOf(nomeColuna);

  const colIdx = {
    placa: indice("placa"),
    marca: indice("marca"),
    modelo: indice("modelo"),
    tipo_veiculo: indice("tipo_veiculo"),
    classificacao: indice("classificacao"),
    motor: indice("motor"),
    ano_modelo: indice("ano_modelo"),
    ano_fabricacao: indice("ano_fabricacao"),
    combustivel: indice("combustivel"),
    tanque: indice("tanque"),
    autonomia: indice("autonomia"),
    numero_eixos: indice("numero_eixos"),
    cor: indice("cor"),
    chassi: indice("chassi"),
    renavam: indice("renavam"),
    municipio: indice("municipio"),
    uf_veiculo: indice("uf_veiculo"),
    centro_custo: indice("centro_custo"),
    cnpj_cliente: indice("cnpj_cliente"),
  };

  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => indice(c) === -1);
  if (faltando.length > 0) {
    return {
      erro: `O arquivo precisa ter as colunas obrigatórias: ${COLUNAS_OBRIGATORIAS.join(", ")}. Faltando: ${faltando.join(", ")}.`,
    };
  }

  const supabase = await createClient();

  const { data: empresas } = await supabase.from("empresas").select("id, cnpj");
  const cnpjPorEmpresaId = new Map<string, string>();
  const empresaIdPorCnpj = new Map<string, string>();
  for (const empresa of empresas ?? []) {
    if (empresa.cnpj) {
      empresaIdPorCnpj.set(normalizarCNPJ(empresa.cnpj), empresa.id);
      cnpjPorEmpresaId.set(empresa.id, empresa.cnpj);
    }
  }

  const { data: centros } = await supabase.from("centros_custo").select("id, nome");
  const centroIdPorNome = new Map<string, string>();
  for (const centro of centros ?? []) {
    centroIdPorNome.set(centro.nome.trim().toLowerCase(), centro.id);
  }

  const pegar = (colunas: string[], chave: keyof typeof colIdx) => {
    const idx = colIdx[chave];
    return idx >= 0 ? (colunas[idx] ?? "").trim() : "";
  };

  type LinhaValida = {
    numeroLinha: number;
    placa: string;
    chave: string;
    cnpjFrota: string;
    empresaId: string;
    camposInsert: VeiculoInsert;
    camposUpdate: VeiculoUpdate;
    // Fase Sincronizar-Caracteristicas-Grupo (12/08/2026) — subconjunto de
    // camposUpdate só com as características físicas do veículo (sem
    // classificação nem centro de custo, que são específicos de cada
    // empresa). É isso que se propaga pros irmãos do mesmo grupo
    // econômico com a mesma placa, ver passo 4.
    camposCaracteristicas: VeiculoUpdate;
    avisoCentroCusto: string;
  };

  const resultado: LinhaResultado[] = [];
  const validas: LinhaValida[] = [];

  // Passo 1: parseia e valida cada linha (resolve cliente, centro de
  // custo), sem gravar nada ainda -- só depois de validar todas é que dá
  // pra saber quais clientes buscar em lote no passo 2.
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i];
    const numeroLinha = i + 1;

    const placa = pegar(colunas, "placa").toUpperCase();
    const cnpjBruto = pegar(colunas, "cnpj_cliente");
    const classificacaoBruta = pegar(colunas, "classificacao");
    const classificacaoValida = CLASSIFICACAO.includes(classificacaoBruta as Classificacao)
      ? (classificacaoBruta as Classificacao)
      : null;
    const centroCustoNomeBruto = pegar(colunas, "centro_custo");

    try {
      if (!placa) throw new Error("Placa é obrigatória.");

      const cnpjNormalizado = normalizarCNPJ(cnpjBruto);
      if (!cnpjNormalizado) throw new Error("Informe o CNPJ do cliente (coluna cnpj_cliente).");
      const empresaId = empresaIdPorCnpj.get(cnpjNormalizado);
      if (!empresaId) throw new Error(`Nenhum cliente cadastrado com o CNPJ ${cnpjBruto}.`);
      const cnpjFrota = cnpjPorEmpresaId.get(empresaId)!;

      let centroCustoId: string | null = null;
      let avisoCentroCusto = "";
      if (centroCustoNomeBruto) {
        centroCustoId = centroIdPorNome.get(centroCustoNomeBruto.toLowerCase()) ?? null;
        if (!centroCustoId) {
          avisoCentroCusto = ` (centro de custo "${centroCustoNomeBruto}" não encontrado — deixado como estava)`;
        }
      }

      const camposTexto: [string, string][] = [
        ["marca", pegar(colunas, "marca")],
        ["modelo", pegar(colunas, "modelo")],
        ["tipo_veiculo", pegar(colunas, "tipo_veiculo")],
        ["motor", pegar(colunas, "motor")],
        ["combustivel", pegar(colunas, "combustivel")],
        ["cor", pegar(colunas, "cor")],
        ["chassi", pegar(colunas, "chassi")],
        ["renavam", pegar(colunas, "renavam")],
        ["municipio", pegar(colunas, "municipio")],
        ["uf_veiculo", pegar(colunas, "uf_veiculo")],
      ];
      const camposNumero: [string, string][] = [
        ["ano_modelo", pegar(colunas, "ano_modelo")],
        ["ano_fabricacao", pegar(colunas, "ano_fabricacao")],
        ["tanque", pegar(colunas, "tanque")],
        ["autonomia", pegar(colunas, "autonomia")],
        ["numero_eixos", pegar(colunas, "numero_eixos")],
      ];

      const camposInsert: VeiculoInsert = {
        cnpj_frota: cnpjFrota,
        placa,
        classificacao: classificacaoValida ?? "Próprio",
        centro_custo_id: centroCustoId,
        centro_custo_nome: centroCustoId ? centroCustoNomeBruto : null,
        ativo: true,
      };
      const camposCaracteristicas: VeiculoUpdate = {};

      // Os campos de texto/número acima são todos colunas de mesmo tipo
      // (string | null / number | null) em cadastro_veiculos -- o cast por
      // campo evita ter que repetir 15x o mesmo par insert/característica.
      for (const [campo, valor] of camposTexto) {
        (camposInsert as unknown as Record<string, string | null>)[campo] = valor || null;
        if (valor) (camposCaracteristicas as unknown as Record<string, string>)[campo] = valor;
      }
      for (const [campo, valor] of camposNumero) {
        const numero = numeroOuNull(valor);
        (camposInsert as unknown as Record<string, number | null>)[campo] = numero;
        if (valor && numero !== null) (camposCaracteristicas as unknown as Record<string, number>)[campo] = numero;
      }

      // camposUpdate = características (propagáveis pro grupo) + campos
      // específicos desta empresa (classificação, centro de custo), que
      // NUNCA propagam.
      const camposUpdate: VeiculoUpdate = { ...camposCaracteristicas };
      if (classificacaoValida) camposUpdate.classificacao = classificacaoValida;
      if (centroCustoId) {
        camposUpdate.centro_custo_id = centroCustoId;
        camposUpdate.centro_custo_nome = centroCustoNomeBruto;
      }

      validas.push({
        numeroLinha,
        placa,
        chave: `${normalizarChave(cnpjFrota)}|${normalizarChave(placa)}`,
        cnpjFrota,
        empresaId,
        camposInsert,
        camposUpdate,
        camposCaracteristicas,
        avisoCentroCusto,
      });
    } catch (e) {
      resultado.push({
        linha: numeroLinha,
        identificacao: placa || "(sem placa)",
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  // Passo 2: busca em lote os veículos já cadastrados com alguma dessas
  // placas. Usa a RPC veiculos_existentes_por_placa em vez de
  // .select().in("cnpj_frota", ...) de propósito: cnpj_frota é texto
  // copiado (não FK) e ficou com formatação inconsistente entre lotes de
  // importação antigos ("25265787000144" vs "25.265.787/0001-44" pro
  // mesmo cliente) -- filtrar pelo texto exato de empresas.cnpj perdia
  // linhas salvas no formato antigo. A RPC já devolve cnpj_frota e placa
  // normalizados (mesma expressão do índice único
  // cadastro_veiculos_cnpj_placa_norm_uidx), então o casamento abaixo é
  // sempre por valor normalizado dos dois lados.
  const placasEnvolvidas = [...new Set(validas.map((v) => v.placa))];
  const { data: existentes } =
    placasEnvolvidas.length > 0
      ? await supabase.rpc("veiculos_existentes_por_placa", { p_placas: placasEnvolvidas })
      : { data: [] };
  const idPorChave = new Map<string, string>();
  for (const v of existentes ?? []) {
    idPorChave.set(`${v.cnpj_frota_norm}|${v.placa_norm}`, v.id);
  }

  // Passo 3: grava -- update parcial se o veículo já existe, insert
  // completo se não. Passo 4 (logo abaixo, achado do Daniel 12/08/2026):
  // depois de gravar, propaga as CARACTERÍSTICAS (não classificação, não
  // centro de custo) pros veículos irmãos com a mesma placa em outras
  // empresas do mesmo grupo econômico -- pra não ficarem descasados.
  // Diferente da tela de Duplicidades (que trata placa repetida no grupo
  // como erro a corrigir/inativar), aqui a decisão do Daniel foi tratar
  // como o mesmo veículo de verdade.
  for (const v of validas) {
    const idExistente = idPorChave.get(v.chave);
    let avisoSincronizacao = "";
    try {
      if (idExistente) {
        const { error } = await supabase.from("cadastro_veiculos").update(v.camposUpdate).eq("id", idExistente);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("cadastro_veiculos").insert(v.camposInsert);
        if (error) throw new Error(error.message);
      }

      if (Object.keys(v.camposCaracteristicas).length > 0) {
        const { data: irmaos } = await supabase.rpc("veiculos_grupo_mesma_placa", {
          p_empresa_id: v.empresaId,
          p_placa: v.placa,
        });
        const nomesSincronizados: string[] = [];
        for (const irmao of irmaos ?? []) {
          const { error: erroIrmao } = await supabase
            .from("cadastro_veiculos")
            .update(v.camposCaracteristicas)
            .eq("id", irmao.veiculo_id);
          if (!erroIrmao) nomesSincronizados.push(irmao.empresa_nome);
        }
        if (nomesSincronizados.length > 0) {
          avisoSincronizacao = ` Também sincronizado em: ${nomesSincronizados.join(", ")}.`;
        }
      }

      resultado.push({
        linha: v.numeroLinha,
        identificacao: v.placa,
        status: "ok",
        mensagem: idExistente
          ? `Veículo já cadastrado — dados atualizados.${v.avisoCentroCusto}${avisoSincronizacao}`
          : `Importado com sucesso.${v.avisoCentroCusto}${avisoSincronizacao}`,
      });
    } catch (e) {
      resultado.push({
        linha: v.numeroLinha,
        identificacao: v.placa,
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  resultado.sort((a, b) => a.linha - b.linha);

  revalidatePath("/veiculos");

  return {
    total: resultado.length,
    sucesso: resultado.filter((r) => r.status === "ok").length,
    erros: resultado.filter((r) => r.status === "erro").length,
    linhas: resultado,
  };
}
