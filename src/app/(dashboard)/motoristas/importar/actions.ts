"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerPlanilhaComoTexto } from "@/lib/xlsx";
import { normalizarCNPJ } from "@/lib/utils";
import { CLASSIFICACAO, type Classificacao } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type MotoristaInsert = Database["public"]["Tables"]["motoristas"]["Insert"];
type MotoristaUpdate = Database["public"]["Tables"]["motoristas"]["Update"];

export type LinhaResultado = {
  linha: number;
  identificacao: string;
  status: "ok" | "erro";
  mensagem: string;
};

export type ResultadoImportacao =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; linhas: LinhaResultado[] };

const COLUNAS_OBRIGATORIAS = ["nome_completo", "cpf", "cnpj_cliente"];

// Fase Corrige-Reimportação-Motoristas (12/08/2026) — mesmo achado e mesma
// solução aplicada em veiculos/importar/actions.ts: a planilha em lote
// também é usada pra editar motoristas já cadastrados, e o import era
// insert-only. Aqui o único índice único relevante é
// motoristas_empresa_cpf_norm_uidx (empresa_id + CPF só com dígitos), então
// a chave de casamento usa essa mesma normalização. Update é parcial: só
// sobrescreve o que veio preenchido na planilha.
function normalizarCpf(valor: string): string {
  return valor.replace(/[^0-9]/g, "");
}

export async function importarMotoristas(
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

  const iNome = indice("nome_completo");
  const iCpf = indice("cpf");
  const iTelefone = indice("telefone");
  const iEmail = indice("email");
  const iClassificacao = indice("classificacao");
  const iCnh = indice("cnh");
  const iCnhVencimento = indice("cnh_vencimento");
  const iCentroCusto = indice("centro_custo");
  const iCnpj = indice("cnpj_cliente");

  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => indice(c) === -1);
  if (faltando.length > 0) {
    return {
      erro: `O arquivo precisa ter as colunas obrigatórias: ${COLUNAS_OBRIGATORIAS.join(", ")}. Faltando: ${faltando.join(", ")}.`,
    };
  }

  const supabase = await createClient();

  const { data: empresas } = await supabase.from("empresas").select("id, cnpj, nome");
  const empresaIdPorCnpj = new Map<string, string>();
  const nomePorEmpresaId = new Map<string, string>();
  for (const empresa of empresas ?? []) {
    if (empresa.cnpj) empresaIdPorCnpj.set(normalizarCNPJ(empresa.cnpj), empresa.id);
    nomePorEmpresaId.set(empresa.id, empresa.nome);
  }

  const { data: centros } = await supabase.from("centros_custo").select("id, nome");
  const centroIdPorNome = new Map<string, string>();
  for (const centro of centros ?? []) {
    centroIdPorNome.set(centro.nome.trim().toLowerCase(), centro.id);
  }

  type LinhaValida = {
    numeroLinha: number;
    nomeCompleto: string;
    cpf: string;
    chave: string;
    empresaId: string;
    camposInsert: MotoristaInsert;
    camposUpdate: MotoristaUpdate;
    // Fase Sincronizar-Caracteristicas-Grupo (12/08/2026) — subconjunto de
    // camposUpdate só com dados pessoais/CNH do motorista (sem
    // classificação nem centro de custo, específicos de cada empresa).
    // Propagado pros irmãos do mesmo grupo econômico com o mesmo CPF, ver
    // passo 4.
    camposCaracteristicas: MotoristaUpdate;
    avisoCentroCusto: string;
  };

  const resultado: LinhaResultado[] = [];
  const validas: LinhaValida[] = [];

  // Passo 1: parseia e valida cada linha, sem gravar nada ainda.
  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i];
    const numeroLinha = i + 1;

    const nomeCompleto = (colunas[iNome] ?? "").trim();
    const cpf = (colunas[iCpf] ?? "").trim();
    const telefone = iTelefone >= 0 ? (colunas[iTelefone] ?? "").trim() : "";
    const email = iEmail >= 0 ? (colunas[iEmail] ?? "").trim() : "";
    const classificacaoBruta = iClassificacao >= 0 ? (colunas[iClassificacao] ?? "").trim() : "";
    const classificacaoValida = CLASSIFICACAO.includes(classificacaoBruta as Classificacao)
      ? (classificacaoBruta as Classificacao)
      : null;
    const cnh = iCnh >= 0 ? (colunas[iCnh] ?? "").trim() : "";
    const cnhVencimento = iCnhVencimento >= 0 ? (colunas[iCnhVencimento] ?? "").trim() : "";
    const centroCustoNomeBruto = iCentroCusto >= 0 ? (colunas[iCentroCusto] ?? "").trim() : "";
    const cnpjBruto = (colunas[iCnpj] ?? "").trim();

    try {
      if (!nomeCompleto || !cpf) {
        throw new Error("Nome completo e CPF são obrigatórios.");
      }
      const cnpjNormalizado = normalizarCNPJ(cnpjBruto);
      if (!cnpjNormalizado) {
        throw new Error("Informe o CNPJ do cliente (coluna cnpj_cliente).");
      }
      const empresaId = empresaIdPorCnpj.get(cnpjNormalizado);
      if (!empresaId) {
        throw new Error(`Nenhum cliente cadastrado com o CNPJ ${cnpjBruto}.`);
      }

      let centroCustoId: string | null = null;
      let avisoCentroCusto = "";
      if (centroCustoNomeBruto) {
        centroCustoId = centroIdPorNome.get(centroCustoNomeBruto.toLowerCase()) ?? null;
        if (!centroCustoId) {
          avisoCentroCusto = ` (centro de custo "${centroCustoNomeBruto}" não encontrado — deixado como estava)`;
        }
      }

      const camposInsert: MotoristaInsert = {
        empresa_id: empresaId,
        nome_completo: nomeCompleto,
        cpf,
        telefone: telefone || null,
        email: email || null,
        classificacao: classificacaoValida ?? "Próprio",
        cnh: cnh || null,
        cnh_vencimento: cnhVencimento || null,
        centro_custo_id: centroCustoId,
        status: "Ativo",
      };
      const camposCaracteristicas: MotoristaUpdate = { nome_completo: nomeCompleto };
      if (telefone) camposCaracteristicas.telefone = telefone;
      if (email) camposCaracteristicas.email = email;
      if (cnh) camposCaracteristicas.cnh = cnh;
      if (cnhVencimento) camposCaracteristicas.cnh_vencimento = cnhVencimento;

      // camposUpdate = características (propagáveis pro grupo) + campos
      // específicos desta empresa (classificação, centro de custo, status),
      // que NUNCA propagam.
      const camposUpdate: MotoristaUpdate = { ...camposCaracteristicas };
      if (classificacaoValida) camposUpdate.classificacao = classificacaoValida;
      if (centroCustoId) camposUpdate.centro_custo_id = centroCustoId;

      validas.push({
        numeroLinha,
        nomeCompleto,
        cpf,
        chave: `${empresaId}|${normalizarCpf(cpf)}`,
        empresaId,
        camposInsert,
        camposUpdate,
        camposCaracteristicas,
        avisoCentroCusto,
      });
    } catch (e) {
      resultado.push({
        linha: numeroLinha,
        identificacao: nomeCompleto || cpf || "(sem identificação)",
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  // Passo 2: busca em lote os motoristas já cadastrados das empresas
  // envolvidas, casando por empresa_id + CPF normalizado (só dígitos) --
  // mesma normalização de motoristas_empresa_cpf_norm_uidx.
  //
  // Fase Corrige-Import-Empresa-Errada-Grupo (12/08/2026, achado do Daniel
  // no import de veículos, mesmo risco confirmado aqui) — agora também
  // busca `status`: se o único registro deste CPF NESTA empresa estiver
  // Inativo (fantasma deixado por uma resolução de duplicidade anterior),
  // não dá pra tratar como "o registro certo pra atualizar" sem checar
  // primeiro se existe um irmão Ativo no grupo -- ver Passo 3.
  const empresaIdsEnvolvidas = [...new Set(validas.map((v) => v.empresaId))];
  const { data: existentes } =
    empresaIdsEnvolvidas.length > 0
      ? await supabase.from("motoristas").select("id, empresa_id, cpf, status").in("empresa_id", empresaIdsEnvolvidas)
      : { data: [] };
  const existentePorChave = new Map<string, { id: string; ativo: boolean }>();
  for (const m of existentes ?? []) {
    if (!m.cpf) continue;
    existentePorChave.set(`${m.empresa_id}|${normalizarCpf(m.cpf)}`, { id: m.id, ativo: m.status === "Ativo" });
  }

  // Passo 3: grava -- update parcial se o motorista já existe (Ativo) nesta
  // própria empresa, insert completo se não existe em lugar nenhum.
  //
  // Fase Corrige-Import-Empresa-Errada-Grupo (12/08/2026) — caso novo: a
  // empresa desta linha (cnpj_cliente) NÃO tem registro Ativo deste CPF,
  // mas uma empresa IRMÃ do mesmo grupo econômico tem. Antes, o código
  // caía direto em "atualiza o que achou" (mesmo que Inativo) ou "insere
  // novo" -- e o Passo 4 (sincronizar características pros irmãos Ativos)
  // então sobrescrevia o registro Ativo da empresa irmã, dando a impressão
  // de que a importação "foi parar" lá. Agora: se existe irmão Ativo no
  // grupo, o alvo da atualização é ELE (só dados pessoais/CNH -- nunca
  // classificação/centro de custo/status, específicos da empresa da
  // linha), e nenhum registro é criado/reativado nesta empresa.
  for (const v of validas) {
    const existenteProprio = existentePorChave.get(v.chave);
    const temCaracteristicas = Object.keys(v.camposCaracteristicas).length > 0;

    let irmaosAtivos: { motorista_id: string; empresa_id: string; empresa_nome: string }[] = [];
    if (!existenteProprio?.ativo && temCaracteristicas) {
      const { data } = await supabase.rpc("motoristas_grupo_mesmo_cpf", {
        p_empresa_id: v.empresaId,
        p_cpf: v.cpf,
      });
      irmaosAtivos = data ?? [];
    }

    let redirecionadoPara: string | null = null;
    let avisoSincronizacao = "";
    try {
      if (existenteProprio?.ativo) {
        const { error } = await supabase.from("motoristas").update(v.camposUpdate).eq("id", existenteProprio.id);
        if (error) throw new Error(error.message);
      } else if (irmaosAtivos.length > 0) {
        // Não há registro Ativo deste CPF NESTA empresa, mas existe em uma
        // empresa irmã do grupo -- atualiza lá em vez de duplicar ou
        // reviver um fantasma Inativo aqui.
        const nomes: string[] = [];
        for (const irmao of irmaosAtivos) {
          const { error: erroIrmao } = await supabase
            .from("motoristas")
            .update(v.camposCaracteristicas)
            .eq("id", irmao.motorista_id);
          if (!erroIrmao) nomes.push(irmao.empresa_nome);
        }
        if (nomes.length > 0) redirecionadoPara = nomes.join(", ");
      } else if (existenteProprio) {
        // Só existe um registro Inativo deste CPF nesta própria empresa, e
        // nenhum irmão Ativo no grupo -- atualiza os dados nele mesmo
        // assim (sem reativar), em vez de criar um segundo registro.
        const { error } = await supabase.from("motoristas").update(v.camposUpdate).eq("id", existenteProprio.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("motoristas").insert(v.camposInsert);
        if (error) throw new Error(error.message);
      }

      // Passo 4: se a escrita foi NESTA empresa (não redirecionada pro
      // irmão -- nesse caso já sincronizamos acima), propaga dados
      // pessoais/CNH pros demais irmãos Ativos do grupo econômico.
      if (!redirecionadoPara && temCaracteristicas) {
        const { data: irmaos } =
          existenteProprio?.ativo || existenteProprio
            ? await supabase.rpc("motoristas_grupo_mesmo_cpf", { p_empresa_id: v.empresaId, p_cpf: v.cpf })
            : { data: irmaosAtivos };
        const nomesSincronizados: string[] = [];
        for (const irmao of irmaos ?? []) {
          const { error: erroIrmao } = await supabase
            .from("motoristas")
            .update(v.camposCaracteristicas)
            .eq("id", irmao.motorista_id);
          if (!erroIrmao) nomesSincronizados.push(irmao.empresa_nome);
        }
        if (nomesSincronizados.length > 0) {
          avisoSincronizacao = ` Também sincronizado em: ${nomesSincronizados.join(", ")}.`;
        }
      }

      resultado.push({
        linha: v.numeroLinha,
        identificacao: `${v.nomeCompleto} (${v.cpf})`,
        status: "ok",
        mensagem: redirecionadoPara
          ? `Este motorista já está Ativo na empresa "${redirecionadoPara}" (mesmo grupo econômico) — dados pessoais/CNH atualizados lá. Nenhum registro foi criado/alterado em "${nomePorEmpresaId.get(v.empresaId) ?? "empresa desta linha"}" pra evitar duplicidade; campos específicos desta empresa (classificação, centro de custo, status) não se aplicam.`
          : existenteProprio
            ? `Motorista já cadastrado — dados atualizados.${v.avisoCentroCusto}${avisoSincronizacao}`
            : `Importado com sucesso.${v.avisoCentroCusto}${avisoSincronizacao}`,
      });
    } catch (e) {
      resultado.push({
        linha: v.numeroLinha,
        identificacao: `${v.nomeCompleto} (${v.cpf})`,
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  resultado.sort((a, b) => a.linha - b.linha);

  revalidatePath("/motoristas");

  return {
    total: resultado.length,
    sucesso: resultado.filter((r) => r.status === "ok").length,
    erros: resultado.filter((r) => r.status === "erro").length,
    linhas: resultado,
  };
}
