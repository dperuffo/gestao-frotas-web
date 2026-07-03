"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerPlanilhaComoTexto } from "@/lib/xlsx";
import { normalizarCNPJ } from "@/lib/utils";

export type LinhaResultado = {
  linha: number;
  identificacao: string;
  status: "ok" | "erro";
  mensagem: string;
};

export type ResultadoImportacao =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; linhas: LinhaResultado[] };

const COLUNAS_OBRIGATORIAS = ["nome", "cnpj_cliente"];

// Mesmo padrão de importação em lote via planilha já usado em
// Motoristas/Veículos/Abastecimentos: baixa o modelo, preenche uma linha por
// centro de custo, envia o arquivo aqui. Cada linha é resolvida pro cliente
// (empresa) pelo CNPJ, igual ao importador de Motoristas.
export async function importarCentrosCusto(
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

  const iNome = indice("nome");
  const iCodigo = indice("codigo");
  const iResponsavel = indice("responsavel");
  const iDescricao = indice("descricao");
  const iCnpj = indice("cnpj_cliente");

  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => indice(c) === -1);
  if (faltando.length > 0) {
    return {
      erro: `O arquivo precisa ter as colunas obrigatórias: ${COLUNAS_OBRIGATORIAS.join(", ")}. Faltando: ${faltando.join(", ")}.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: empresas } = await supabase.from("empresas").select("id, cnpj");
  const empresaIdPorCnpj = new Map<string, string>();
  for (const empresa of empresas ?? []) {
    if (empresa.cnpj) empresaIdPorCnpj.set(normalizarCNPJ(empresa.cnpj), empresa.id);
  }

  const resultado: LinhaResultado[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i];
    const numeroLinha = i + 1;

    const nome = (colunas[iNome] ?? "").trim();
    const codigo = iCodigo >= 0 ? (colunas[iCodigo] ?? "").trim() || null : null;
    const responsavel = iResponsavel >= 0 ? (colunas[iResponsavel] ?? "").trim() || null : null;
    const descricao = iDescricao >= 0 ? (colunas[iDescricao] ?? "").trim() || null : null;
    const cnpjBruto = (colunas[iCnpj] ?? "").trim();

    try {
      if (!nome) {
        throw new Error("Nome do centro de custo é obrigatório.");
      }
      const cnpjNormalizado = normalizarCNPJ(cnpjBruto);
      if (!cnpjNormalizado) {
        throw new Error("Informe o CNPJ do cliente (coluna cnpj_cliente).");
      }
      const empresaId = empresaIdPorCnpj.get(cnpjNormalizado);
      if (!empresaId) {
        throw new Error(`Nenhum cliente cadastrado com o CNPJ ${cnpjBruto}.`);
      }

      const { error } = await supabase.from("centros_custo").insert({
        empresa_id: empresaId,
        nome,
        codigo,
        responsavel,
        descricao,
        ativo: true,
        criado_por: user?.email ?? null,
      });
      if (error) throw new Error(error.message);

      resultado.push({
        linha: numeroLinha,
        identificacao: nome,
        status: "ok",
        mensagem: "Importado com sucesso.",
      });
    } catch (e) {
      resultado.push({
        linha: numeroLinha,
        identificacao: nome || "(sem identificação)",
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Erro desconhecido.",
      });
    }
  }

  revalidatePath("/centros-custo");

  return {
    total: resultado.length,
    sucesso: resultado.filter((r) => r.status === "ok").length,
    erros: resultado.filter((r) => r.status === "erro").length,
    linhas: resultado,
  };
}
