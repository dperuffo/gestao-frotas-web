"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerPlanilhaComoTexto, data as parseData } from "@/lib/xlsx";
import { normalizarCNPJ } from "@/lib/utils";
import { CLASSIFICACAO, type Classificacao } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type VeiculoInsert =
  Database["public"]["Tables"]["cadastro_veiculos"]["Insert"];
type VeiculoUpdate =
  Database["public"]["Tables"]["cadastro_veiculos"]["Update"];

export type LinhaResultado = {
  linha: number;
  identificacao: string;
  status: "ok" | "erro";
  mensagem: string;
};

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

type Irmao = { veiculo_id: string; empresa_id: string; empresa_nome: string };

// Fase Indicador-Progresso-Import (12/08/2026, pedido do Daniel: planilhas
// de milhares de linhas sem nenhum indicador de andamento) -- uma Server
// Action é uma "caixa preta" pro cliente até terminar: não dá pra reportar
// progresso de DENTRO de uma única chamada. A importação foi dividida em
// duas etapas:
//   1) prepararImportacaoVeiculos -- lê a planilha, valida cada linha e
//      decide, PRA CADA UMA, se vai inserir, atualizar o próprio registro
//      ou redirecionar pro irmão ativo do grupo (mesma lógica de antes,
//      olhando os mapas já carregados em lote). Não grava nada ainda --
//      só devolve o "plano" de cada linha já pronto (LinhaPreparada).
//   2) processarLoteVeiculos -- recebe um PEDAÇO desse plano (um lote
//      escolhido pelo próprio navegador) e só executa as gravações. O
//      navegador chama isso várias vezes, um lote de cada vez, e atualiza
//      uma barra de progresso entre uma chamada e outra.
// Isso também elimina de vez o risco de timeout (achado anterior, HTTP 499
// aos 125s): cada chamada agora é pequena e rápida, não uma só carregando
// milhares de linhas de uma vez.
export type LinhaPreparada = {
  numeroLinha: number;
  placa: string;
  empresaId: string;
  empresaNome: string;
  camposInsert: VeiculoInsert;
  camposUpdate: VeiculoUpdate;
  camposCaracteristicas: VeiculoUpdate;
  avisoCentroCusto: string;
  existenteProprio: { id: string; ativo: boolean } | null;
  irmaosAtivos: Irmao[];
};

export type PreparacaoImportacao =
  | { erro: string }
  | {
      totalLinhas: number;
      errosIniciais: LinhaResultado[];
      preparadas: LinhaPreparada[];
    };

export async function prepararImportacaoVeiculos(
  formData: FormData,
): Promise<PreparacaoImportacao> {
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
    tipo: indice("tipo"),
    classificacao: indice("classificacao"),
    motor: indice("motor"),
    ano_modelo: indice("ano_modelo"),
    ano_fabricacao: indice("ano_fabricacao"),
    combustivel: indice("combustivel"),
    tanque: indice("tanque"),
    autonomia: indice("autonomia"),
    hodometro_atual: indice("hodometro_atual"),
    numero_eixos: indice("numero_eixos"),
    capacidade_kg: indice("capacidade_kg"),
    cor: indice("cor"),
    chassi: indice("chassi"),
    renavam: indice("renavam"),
    municipio: indice("municipio"),
    uf_veiculo: indice("uf_veiculo"),
    centro_custo: indice("centro_custo"),
    valor_aquisicao: indice("valor_aquisicao"),
    data_aquisicao: indice("data_aquisicao"),
    valor_residual_estimado: indice("valor_residual_estimado"),
    vida_util_anos: indice("vida_util_anos"),
    cnpj_cliente: indice("cnpj_cliente"),
  };

  const COLUNAS_OBRIGATORIAS = ["placa", "cnpj_cliente"];
  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => indice(c) === -1);
  if (faltando.length > 0) {
    return {
      erro: `O arquivo precisa ter as colunas obrigatórias: ${COLUNAS_OBRIGATORIAS.join(", ")}. Faltando: ${faltando.join(", ")}.`,
    };
  }

  const supabase = await createClient();

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, cnpj, nome");
  const cnpjPorEmpresaId = new Map<string, string>();
  const empresaIdPorCnpj = new Map<string, string>();
  const nomePorEmpresaId = new Map<string, string>();
  for (const empresa of empresas ?? []) {
    if (empresa.cnpj) {
      empresaIdPorCnpj.set(normalizarCNPJ(empresa.cnpj), empresa.id);
      cnpjPorEmpresaId.set(empresa.id, empresa.cnpj);
    }
    nomePorEmpresaId.set(empresa.id, empresa.nome);
  }

  const { data: centros } = await supabase
    .from("centros_custo")
    .select("id, nome");
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
    empresaId: string;
    camposInsert: VeiculoInsert;
    camposUpdate: VeiculoUpdate;
    camposCaracteristicas: VeiculoUpdate;
    avisoCentroCusto: string;
  };

  const errosIniciais: LinhaResultado[] = [];
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
    const classificacaoValida = CLASSIFICACAO.includes(
      classificacaoBruta as Classificacao,
    )
      ? (classificacaoBruta as Classificacao)
      : null;
    const centroCustoNomeBruto = pegar(colunas, "centro_custo");

    try {
      if (!placa) throw new Error("Placa é obrigatória.");

      const cnpjNormalizado = normalizarCNPJ(cnpjBruto);
      if (!cnpjNormalizado)
        throw new Error("Informe o CNPJ do cliente (coluna cnpj_cliente).");
      const empresaId = empresaIdPorCnpj.get(cnpjNormalizado);
      if (!empresaId)
        throw new Error(`Nenhum cliente cadastrado com o CNPJ ${cnpjBruto}.`);
      const cnpjFrota = cnpjPorEmpresaId.get(empresaId)!;

      let centroCustoId: string | null = null;
      let avisoCentroCusto = "";
      if (centroCustoNomeBruto) {
        centroCustoId =
          centroIdPorNome.get(centroCustoNomeBruto.toLowerCase()) ?? null;
        if (!centroCustoId) {
          avisoCentroCusto = ` (centro de custo "${centroCustoNomeBruto}" não encontrado — deixado como estava)`;
        }
      }

      const camposTexto: [string, string][] = [
        ["marca", pegar(colunas, "marca")],
        ["modelo", pegar(colunas, "modelo")],
        ["tipo_veiculo", pegar(colunas, "tipo_veiculo")],
        ["tipo", pegar(colunas, "tipo")],
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
        ["hodometro_atual", pegar(colunas, "hodometro_atual")],
        ["numero_eixos", pegar(colunas, "numero_eixos")],
        ["capacidade_kg", pegar(colunas, "capacidade_kg")],
      ];
      const camposNumeroAdministrativos: [string, string][] = [
        ["valor_aquisicao", pegar(colunas, "valor_aquisicao")],
        ["valor_residual_estimado", pegar(colunas, "valor_residual_estimado")],
        ["vida_util_anos", pegar(colunas, "vida_util_anos")],
      ];
      const dataAquisicaoBruta = pegar(colunas, "data_aquisicao");
      const dataAquisicao = dataAquisicaoBruta
        ? parseData(dataAquisicaoBruta)
        : null;

      const camposInsert: VeiculoInsert = {
        cnpj_frota: cnpjFrota,
        placa,
        classificacao: classificacaoValida ?? "Próprio",
        centro_custo_id: centroCustoId,
        centro_custo_nome: centroCustoId ? centroCustoNomeBruto : null,
        data_aquisicao: dataAquisicao,
        ativo: true,
      };
      const camposCaracteristicas: VeiculoUpdate = {};

      for (const [campo, valor] of camposTexto) {
        (camposInsert as unknown as Record<string, string | null>)[campo] =
          valor || null;
        if (valor)
          (camposCaracteristicas as unknown as Record<string, string>)[campo] =
            valor;
      }
      for (const [campo, valor] of camposNumero) {
        const numero = numeroOuNull(valor);
        (camposInsert as unknown as Record<string, number | null>)[campo] =
          numero;
        if (valor && numero !== null)
          (camposCaracteristicas as unknown as Record<string, number>)[campo] =
            numero;
      }

      const camposUpdate: VeiculoUpdate = { ...camposCaracteristicas };
      if (classificacaoValida) camposUpdate.classificacao = classificacaoValida;
      if (centroCustoId) {
        camposUpdate.centro_custo_id = centroCustoId;
        camposUpdate.centro_custo_nome = centroCustoNomeBruto;
      }
      for (const [campo, valor] of camposNumeroAdministrativos) {
        const numero = numeroOuNull(valor);
        (camposInsert as unknown as Record<string, number | null>)[campo] =
          numero;
        if (valor && numero !== null)
          (camposUpdate as unknown as Record<string, number>)[campo] = numero;
      }
      if (dataAquisicao) camposUpdate.data_aquisicao = dataAquisicao;

      validas.push({
        numeroLinha,
        placa,
        chave: `${normalizarChave(cnpjFrota)}|${normalizarChave(placa)}`,
        empresaId,
        camposInsert,
        camposUpdate,
        camposCaracteristicas,
        avisoCentroCusto,
      });
    } catch (e) {
      errosIniciais.push({
        linha: numeroLinha,
        identificacao: placa || "(sem placa)",
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  // Passo 2: busca em lote os veículos já cadastrados com alguma dessas
  // placas, via RPC (normalizada -- ver comentário original mais abaixo no
  // README/histórico sobre cnpj_frota com formatação inconsistente), e os
  // ids do grupo econômico de cada empresa envolvida (1 chamada por
  // empresa, não por linha).
  const placasEnvolvidas = [...new Set(validas.map((v) => v.placa))];
  const { data: existentes } =
    placasEnvolvidas.length > 0
      ? await supabase.rpc("veiculos_existentes_por_placa", {
          p_placas: placasEnvolvidas,
        })
      : { data: [] };
  const existentePorChave = new Map<string, { id: string; ativo: boolean }>();
  const existentesPorPlacaNorm = new Map<
    string,
    { id: string; cnpj_frota_norm: string; ativo: boolean }[]
  >();
  for (const v of existentes ?? []) {
    existentePorChave.set(`${v.cnpj_frota_norm}|${v.placa_norm}`, {
      id: v.id,
      ativo: v.ativo,
    });
    const lista = existentesPorPlacaNorm.get(v.placa_norm) ?? [];
    lista.push({
      id: v.id,
      cnpj_frota_norm: v.cnpj_frota_norm,
      ativo: v.ativo,
    });
    existentesPorPlacaNorm.set(v.placa_norm, lista);
  }

  const empresaIdsEnvolvidas = [...new Set(validas.map((v) => v.empresaId))];
  const grupoIdsPorEmpresa = new Map<string, Set<string>>();
  for (const empresaId of empresaIdsEnvolvidas) {
    const { data: grupoIds } = await supabase.rpc("grupo_ids_da_empresa", {
      p_empresa_id: empresaId,
    });
    grupoIdsPorEmpresa.set(empresaId, new Set(grupoIds ?? []));
  }

  function irmaosAtivosDoGrupo(v: LinhaValida): Irmao[] {
    const grupoIds = grupoIdsPorEmpresa.get(v.empresaId) ?? new Set<string>();
    const candidatos =
      existentesPorPlacaNorm.get(normalizarChave(v.placa)) ?? [];
    const irmaos: Irmao[] = [];
    for (const c of candidatos) {
      if (!c.ativo) continue;
      const empresaIdCandidato = empresaIdPorCnpj.get(c.cnpj_frota_norm);
      if (!empresaIdCandidato || empresaIdCandidato === v.empresaId) continue;
      if (!grupoIds.has(empresaIdCandidato)) continue;
      irmaos.push({
        veiculo_id: c.id,
        empresa_id: empresaIdCandidato,
        empresa_nome: nomePorEmpresaId.get(empresaIdCandidato) ?? "",
      });
    }
    return irmaos;
  }

  // Fase Corrige-Import-Empresa-Errada-Grupo (12/08/2026) — pra cada linha,
  // já decide de antemão pra onde a gravação vai: registro ativo da própria
  // empresa, irmão ativo do grupo (quando esta empresa não tem registro
  // ativo desta placa), ou registro inativo próprio como último recurso.
  // Ver comentário completo em processarLoteVeiculos, onde essa decisão é
  // efetivamente executada.
  const preparadas: LinhaPreparada[] = validas.map((v) => {
    const existenteProprio = existentePorChave.get(v.chave) ?? null;
    const temCaracteristicas = Object.keys(v.camposCaracteristicas).length > 0;
    const irmaosAtivos = temCaracteristicas ? irmaosAtivosDoGrupo(v) : [];
    return {
      numeroLinha: v.numeroLinha,
      placa: v.placa,
      empresaId: v.empresaId,
      empresaNome: nomePorEmpresaId.get(v.empresaId) ?? "empresa desta linha",
      camposInsert: v.camposInsert,
      camposUpdate: v.camposUpdate,
      camposCaracteristicas: v.camposCaracteristicas,
      avisoCentroCusto: v.avisoCentroCusto,
      existenteProprio,
      irmaosAtivos,
    };
  });

  return {
    totalLinhas: preparadas.length + errosIniciais.length,
    errosIniciais,
    preparadas,
  };
}

// Fase Indicador-Progresso-Import (12/08/2026) — executa só a gravação de
// um LOTE já decidido (ver prepararImportacaoVeiculos acima). O navegador
// chama isso repetidamente, um lote de cada vez, e atualiza a barra de
// progresso entre uma chamada e outra -- ver ImportForm.tsx.
export async function processarLoteVeiculos(
  lote: LinhaPreparada[],
): Promise<LinhaResultado[]> {
  const supabase = await createClient();
  const resultado: LinhaResultado[] = [];

  await Promise.all(
    lote.map(async (v) => {
      const temCaracteristicas =
        Object.keys(v.camposCaracteristicas).length > 0;
      let redirecionadoPara: string | null = null;
      let avisoSincronizacao = "";
      try {
        if (v.existenteProprio?.ativo) {
          // Caminho normal: já existe um registro ATIVO desta placa nesta
          // própria empresa -- atualiza ele.
          const { error } = await supabase
            .from("cadastro_veiculos")
            .update(v.camposUpdate)
            .eq("id", v.existenteProprio.id);
          if (error) throw new Error(error.message);
        } else if (v.irmaosAtivos.length > 0) {
          // Não há registro ativo desta placa NESTA empresa, mas existe em
          // uma empresa irmã do grupo -- atualiza lá em vez de duplicar ou
          // reviver um fantasma inativo aqui.
          const nomes: string[] = [];
          for (const irmao of v.irmaosAtivos) {
            const { error: erroIrmao } = await supabase
              .from("cadastro_veiculos")
              .update(v.camposCaracteristicas)
              .eq("id", irmao.veiculo_id);
            if (!erroIrmao) nomes.push(irmao.empresa_nome);
          }
          if (nomes.length > 0) redirecionadoPara = nomes.join(", ");
        } else if (v.existenteProprio) {
          // Só existe um registro INATIVO desta placa nesta própria
          // empresa, e nenhum irmão ativo no grupo -- atualiza os dados
          // nele mesmo assim (sem reativar), em vez de criar um segundo
          // registro.
          const { error } = await supabase
            .from("cadastro_veiculos")
            .update(v.camposUpdate)
            .eq("id", v.existenteProprio.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase
            .from("cadastro_veiculos")
            .insert(v.camposInsert);
          if (error) throw new Error(error.message);
        }

        if (!redirecionadoPara && temCaracteristicas) {
          const nomesSincronizados: string[] = [];
          for (const irmao of v.irmaosAtivos) {
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
          mensagem: redirecionadoPara
            ? `Este veículo já está ativo na empresa "${redirecionadoPara}" (mesmo grupo econômico) — características atualizadas lá. Nenhum registro foi criado/alterado em "${v.empresaNome}" pra evitar duplicidade; campos específicos desta empresa (classificação, centro de custo) não se aplicam.`
            : v.existenteProprio
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
    }),
  );

  revalidatePath("/veiculos");
  return resultado;
}
