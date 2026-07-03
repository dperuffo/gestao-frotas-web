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

const COLUNAS_OBRIGATORIAS = ["placa", "cnpj_cliente"];

function numeroOuNull(valor: string) {
  const texto = valor.trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
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

  const resultado: LinhaResultado[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i];
    const numeroLinha = i + 1;

    const placa = pegar(colunas, "placa").toUpperCase();
    const cnpjBruto = pegar(colunas, "cnpj_cliente");
    const classificacaoBruta = pegar(colunas, "classificacao");
    const classificacao: Classificacao = CLASSIFICACAO.includes(classificacaoBruta as Classificacao)
      ? (classificacaoBruta as Classificacao)
      : "Próprio";
    const centroCustoNomeBruto = pegar(colunas, "centro_custo");

    try {
      if (!placa) throw new Error("Placa é obrigatória.");

      const cnpjNormalizado = normalizarCNPJ(cnpjBruto);
      if (!cnpjNormalizado) throw new Error("Informe o CNPJ do cliente (coluna cnpj_cliente).");
      const empresaId = empresaIdPorCnpj.get(cnpjNormalizado);
      if (!empresaId) throw new Error(`Nenhum cliente cadastrado com o CNPJ ${cnpjBruto}.`);
      const cnpjFrota = cnpjPorEmpresaId.get(empresaId)!;

      let centroCustoId: string | null = null;
      let centroCustoNome: string | null = null;
      let avisoCentroCusto = "";
      if (centroCustoNomeBruto) {
        centroCustoId = centroIdPorNome.get(centroCustoNomeBruto.toLowerCase()) ?? null;
        if (centroCustoId) {
          centroCustoNome = centroCustoNomeBruto;
        } else {
          avisoCentroCusto = ` (centro de custo "${centroCustoNomeBruto}" não encontrado — deixado em branco)`;
        }
      }

      const { error } = await supabase.from("cadastro_veiculos").insert({
        cnpj_frota: cnpjFrota,
        placa,
        marca: pegar(colunas, "marca") || null,
        modelo: pegar(colunas, "modelo") || null,
        tipo_veiculo: pegar(colunas, "tipo_veiculo") || null,
        classificacao,
        motor: pegar(colunas, "motor") || null,
        ano_modelo: numeroOuNull(pegar(colunas, "ano_modelo")),
        ano_fabricacao: numeroOuNull(pegar(colunas, "ano_fabricacao")),
        combustivel: pegar(colunas, "combustivel") || null,
        tanque: numeroOuNull(pegar(colunas, "tanque")),
        autonomia: numeroOuNull(pegar(colunas, "autonomia")),
        numero_eixos: numeroOuNull(pegar(colunas, "numero_eixos")),
        cor: pegar(colunas, "cor") || null,
        chassi: pegar(colunas, "chassi") || null,
        renavam: pegar(colunas, "renavam") || null,
        municipio: pegar(colunas, "municipio") || null,
        uf_veiculo: pegar(colunas, "uf_veiculo") || null,
        centro_custo_id: centroCustoId,
        centro_custo_nome: centroCustoNome,
        ativo: true,
      });
      if (error) throw new Error(error.message);

      resultado.push({
        linha: numeroLinha,
        identificacao: placa,
        status: "ok",
        mensagem: `Importado com sucesso.${avisoCentroCusto}`,
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

  revalidatePath("/veiculos");

  return {
    total: resultado.length,
    sucesso: resultado.filter((r) => r.status === "ok").length,
    erros: resultado.filter((r) => r.status === "erro").length,
    linhas: resultado,
  };
}
