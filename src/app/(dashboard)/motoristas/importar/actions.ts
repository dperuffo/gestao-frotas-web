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

  const { data: empresas } = await supabase.from("empresas").select("id, cnpj");
  const empresaIdPorCnpj = new Map<string, string>();
  for (const empresa of empresas ?? []) {
    if (empresa.cnpj) empresaIdPorCnpj.set(normalizarCNPJ(empresa.cnpj), empresa.id);
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
      const camposUpdate: MotoristaUpdate = { nome_completo: nomeCompleto };
      if (telefone) camposUpdate.telefone = telefone;
      if (email) camposUpdate.email = email;
      if (classificacaoValida) camposUpdate.classificacao = classificacaoValida;
      if (cnh) camposUpdate.cnh = cnh;
      if (cnhVencimento) camposUpdate.cnh_vencimento = cnhVencimento;
      if (centroCustoId) camposUpdate.centro_custo_id = centroCustoId;

      validas.push({
        numeroLinha,
        nomeCompleto,
        cpf,
        chave: `${empresaId}|${normalizarCpf(cpf)}`,
        empresaId,
        camposInsert,
        camposUpdate,
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
  const empresaIdsEnvolvidas = [...new Set(validas.map((v) => v.empresaId))];
  const { data: existentes } =
    empresaIdsEnvolvidas.length > 0
      ? await supabase.from("motoristas").select("id, empresa_id, cpf").in("empresa_id", empresaIdsEnvolvidas)
      : { data: [] };
  const idPorChave = new Map<string, string>();
  for (const m of existentes ?? []) {
    if (!m.cpf) continue;
    idPorChave.set(`${m.empresa_id}|${normalizarCpf(m.cpf)}`, m.id);
  }

  // Passo 3: grava -- update parcial se o motorista já existe, insert
  // completo se não.
  for (const v of validas) {
    const idExistente = idPorChave.get(v.chave);
    try {
      if (idExistente) {
        const { error } = await supabase.from("motoristas").update(v.camposUpdate).eq("id", idExistente);
        if (error) throw new Error(error.message);
        resultado.push({
          linha: v.numeroLinha,
          identificacao: `${v.nomeCompleto} (${v.cpf})`,
          status: "ok",
          mensagem: `Motorista já cadastrado — dados atualizados.${v.avisoCentroCusto}`,
        });
      } else {
        const { error } = await supabase.from("motoristas").insert(v.camposInsert);
        if (error) throw new Error(error.message);
        resultado.push({
          linha: v.numeroLinha,
          identificacao: `${v.nomeCompleto} (${v.cpf})`,
          status: "ok",
          mensagem: `Importado com sucesso.${v.avisoCentroCusto}`,
        });
      }
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
