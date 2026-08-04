"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lerPlanilhaComoTexto } from "@/lib/xlsx";
import { normalizarCNPJ } from "@/lib/utils";
import { garantirVeiculoCadastrado, garantirMotoristaCadastrado } from "@/lib/cadastrosAutomaticos";
import { empresaDonaDoVeiculoAcao } from "@/lib/empresasGrupo";

export type LinhaResultado = {
  linha: number;
  identificacao: string;
  status: "ok" | "erro";
  mensagem: string;
};

export type ResultadoImportacao =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; linhas: LinhaResultado[] };

const COLUNAS_OBRIGATORIAS = ["cnpj_cliente"];

function numeroOuNull(valor: string) {
  const texto = valor.trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Aceita "AAAA-MM-DD HH:MM" ou só "AAAA-MM-DD" e devolve um ISO string, ou
// null se estiver vazio/ inválido.
function dataOuNull(valor: string) {
  const texto = valor.trim();
  if (!texto) return null;
  const data = new Date(texto.replace(" ", "T"));
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

export async function importarAbastecimentos(
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
    data_abastecimento: indice("data_abastecimento"),
    veiculo_placa: indice("veiculo_placa"),
    motorista_nome: indice("motorista_nome"),
    hodometro: indice("hodometro"),
    produto: indice("produto"),
    litros: indice("litros"),
    preco_litro: indice("preco_litro"),
    valor_total: indice("valor_total"),
    posto_nome: indice("posto_nome"),
    posto_municipio: indice("posto_municipio"),
    posto_uf: indice("posto_uf"),
    cnpj_cliente: indice("cnpj_cliente"),
  };

  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => indice(c) === -1);
  if (faltando.length > 0) {
    return {
      erro: `O arquivo precisa ter as colunas obrigatórias: ${COLUNAS_OBRIGATORIAS.join(", ")}. Faltando: ${faltando.join(", ")}.`,
    };
  }

  const supabase = await createClient();

  const { data: empresas } = await supabase.from("empresas").select("id, nome, cnpj");
  const empresaPorCnpj = new Map<string, { id: string; nome: string; cnpj: string }>();
  for (const empresa of empresas ?? []) {
    if (empresa.cnpj) empresaPorCnpj.set(normalizarCNPJ(empresa.cnpj), { id: empresa.id, nome: empresa.nome, cnpj: empresa.cnpj });
  }

  const pegar = (colunas: string[], chave: keyof typeof colIdx) => {
    const idx = colIdx[chave];
    return idx >= 0 ? (colunas[idx] ?? "").trim() : "";
  };

  const resultado: LinhaResultado[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const colunas = linhas[i];
    const numeroLinha = i + 1;

    const placa = pegar(colunas, "veiculo_placa").toUpperCase();
    const cnpjBruto = pegar(colunas, "cnpj_cliente");

    try {
      const cnpjNormalizado = normalizarCNPJ(cnpjBruto);
      if (!cnpjNormalizado) throw new Error("Informe o CNPJ do cliente (coluna cnpj_cliente).");
      const empresa = empresaPorCnpj.get(cnpjNormalizado);
      if (!empresa) throw new Error(`Nenhum cliente cadastrado com o CNPJ ${cnpjBruto}.`);

      const { data: seq, error: seqError } = await supabase.rpc("nextval_identificador_manual");
      if (seqError || seq == null) throw new Error("Não foi possível gerar o identificador do lançamento.");
      const identificador = seq as number;

      // Fase Reuso-Operacional-Grupo (Fase 3) — se a placa da linha já tem
      // cadastro e pertence a uma empresa IRMÃ do cnpj_cliente da planilha,
      // o custo fica com a empresa DONA do veículo (mesmo critério do
      // lançamento manual, Hub de Integrações e trigger da PróFrotas).
      const empresaDonaVeiculo = placa ? await empresaDonaDoVeiculoAcao(supabase, placa) : null;
      const empresaIdAbastecimento = empresaDonaVeiculo ?? empresa.id;

      const { error } = await supabase.from("profrotas_abastecimentos").insert({
        cnpj_frota: empresa.cnpj,
        frota_cnpj: empresa.cnpj,
        frota_razao_social: empresa.nome,
        empresa_id: empresaIdAbastecimento,
        identificador,
        sync_key: `manual-${identificador}`,
        abastecimento_estornado: 0,
        status_autorizacao: 1,
        item_tipo: 1,
        data_abastecimento: dataOuNull(pegar(colunas, "data_abastecimento")),
        veiculo_placa: placa || null,
        motorista_nome: pegar(colunas, "motorista_nome") || null,
        hodometro: numeroOuNull(pegar(colunas, "hodometro")),
        item_nome: pegar(colunas, "produto") || null,
        item_quantidade: numeroOuNull(pegar(colunas, "litros")),
        item_valor_unitario: numeroOuNull(pegar(colunas, "preco_litro")),
        item_valor_total: numeroOuNull(pegar(colunas, "valor_total")),
        pv_razao_social: pegar(colunas, "posto_nome") || null,
        pv_municipio: pegar(colunas, "posto_municipio") || null,
        pv_uf: pegar(colunas, "posto_uf") || null,
      });
      if (error) throw new Error(error.message);

      // Fase auto-cadastro-abastecimento (27/07/2026) — pedido do Daniel:
      // vale pra QUALQUER importação, não só a PróFrotas — inclusive esta
      // carga manual via planilha. Sem CPF nesta coluna, cai no match por
      // nome (mesmo caminho da sincronização PróFrotas).
      const nomeMotorista = pegar(colunas, "motorista_nome");
      if (placa) await garantirVeiculoCadastrado(supabase, empresa.cnpj, placa);
      if (nomeMotorista) await garantirMotoristaCadastrado(supabase, empresa.id, { nomeCompleto: nomeMotorista });

      resultado.push({
        linha: numeroLinha,
        identificacao: placa || "(sem placa)",
        status: "ok",
        mensagem: "Importado com sucesso.",
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

  revalidatePath("/abastecimentos");

  return {
    total: resultado.length,
    sucesso: resultado.filter((r) => r.status === "ok").length,
    erros: resultado.filter((r) => r.status === "erro").length,
    linhas: resultado,
  };
}
