"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerPlanilhaComoTexto } from "@/lib/xlsx";
import { normalizarCNPJ } from "@/lib/utils";
import { CLASSIFICACAO, type Classificacao } from "@/lib/constants";

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

  const resultado: LinhaResultado[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i];
    const numeroLinha = i + 1;

    const nomeCompleto = (colunas[iNome] ?? "").trim();
    const cpf = (colunas[iCpf] ?? "").trim();
    const telefone = iTelefone >= 0 ? (colunas[iTelefone] ?? "").trim() || null : null;
    const email = iEmail >= 0 ? (colunas[iEmail] ?? "").trim() || null : null;
    const classificacaoBruta = iClassificacao >= 0 ? (colunas[iClassificacao] ?? "").trim() : "";
    const classificacao: Classificacao = CLASSIFICACAO.includes(classificacaoBruta as Classificacao)
      ? (classificacaoBruta as Classificacao)
      : "Próprio";
    const cnh = iCnh >= 0 ? (colunas[iCnh] ?? "").trim() || null : null;
    const cnhVencimento = iCnhVencimento >= 0 ? (colunas[iCnhVencimento] ?? "").trim() || null : null;
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
          avisoCentroCusto = ` (centro de custo "${centroCustoNomeBruto}" não encontrado — deixado em branco)`;
        }
      }

      const { error } = await supabase.from("motoristas").insert({
        empresa_id: empresaId,
        nome_completo: nomeCompleto,
        cpf,
        telefone,
        email,
        classificacao,
        cnh,
        cnh_vencimento: cnhVencimento,
        centro_custo_id: centroCustoId,
        status: "Ativo",
      });
      if (error) throw new Error(error.message);

      resultado.push({
        linha: numeroLinha,
        identificacao: `${nomeCompleto} (${cpf})`,
        status: "ok",
        mensagem: `Importado com sucesso.${avisoCentroCusto}`,
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

  revalidatePath("/motoristas");

  return {
    total: resultado.length,
    sucesso: resultado.filter((r) => r.status === "ok").length,
    erros: resultado.filter((r) => r.status === "erro").length,
    linhas: resultado,
  };
}
