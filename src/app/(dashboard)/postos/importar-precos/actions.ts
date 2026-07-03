"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerAba, texto, textoOuNull, numero, data as celulaData, dedupePorChave } from "@/lib/xlsx";
import { normalizarCNPJ, resolverUf } from "@/lib/utils";
import type { Database } from "@/types/database.types";

export type ResultadoImportacaoPrecos =
  | { erro: string }
  | { total: number; sucesso: number; erros: number; duplicadas: number };

type LinhaPreco = Database["public"]["Tables"]["historico_precos"]["Insert"];

// Colunas da aba "Preços" de preco_posto.xlsx, na ordem exata do arquivo
// exportado (planilha recorrente da integração Pró-Frotas):
// 0 Data de Vigência · 1 Data de Atualização · 2 Código Pró-Frotas ·
// 3 Ponto de Venda · 4 CNPJ do Ponto de Venda · 5 Cidade · 6 UF ·
// 7 Código ABADI · 8 Produto · 9 Preço Posto (R$) · 10 Preço Anterior ·
// 11 Preço Referência · 12 Status · 13 Status do Ponto de Venda ·
// 14 Origem da Alteração Preço · 15 Bandeira
const COL = {
  dataVigencia: 0,
  dataAtualizacao: 1,
  codigoProfrotas: 2,
  pontoDeVenda: 3,
  cnpj: 4,
  cidade: 5,
  uf: 6,
  codigoAbadi: 7,
  produto: 8,
  precoPosto: 9,
  precoAnterior: 10,
  precoReferencia: 11,
  status: 12,
  statusPontoVenda: 13,
  origemAlteracao: 14,
  bandeira: 15,
} as const;

export async function importarPrecos(
  _prev: ResultadoImportacaoPrecos | undefined,
  formData: FormData
): Promise<ResultadoImportacaoPrecos> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione o arquivo preco_posto.xlsx." };
  }

  const buffer = await arquivo.arrayBuffer();
  const linhasDaAba = lerAba(buffer, "Preços");
  const linhas = linhasDaAba.length > 0 ? linhasDaAba : lerAba(buffer);
  if (linhas.length < 2) {
    return { erro: "A planilha está vazia ou não tem nenhuma linha de dados." };
  }

  const primeiraCelula = texto(linhas[0][COL.dataVigencia]).toLowerCase();
  if (!primeiraCelula.includes("vig")) {
    return {
      erro: 'A primeira coluna da planilha precisa ser "Data de Vigência" — confira se o arquivo enviado é o modelo correto (aba "Preços").',
    };
  }

  // Esta importação é cross-tenant por natureza: uma única planilha da
  // integração Pró-Frotas traz preços de postos de VÁRIOS clientes ao mesmo
  // tempo (não há seletor de cliente nesta tela) e muitos CNPJs nem sequer
  // pertencem a algum cliente ainda (empresa_id fica null de propósito).
  // O RLS por tenant bloquearia a maioria das linhas, então usamos o cliente
  // com chave de service role — mesma lógica de "operação administrativa"
  // já usada para convite de usuários (ver src/lib/supabase/admin.ts).
  const supabase = createAdminClient();

  // Casa o CNPJ do posto com o cliente dono dele (se já estiver na rede
  // negociada em postos_gf) para preencher empresa_id automaticamente.
  const { data: postos } = await supabase.from("postos_gf").select("cnpj, empresa_id");
  const empresaPorCnpj = new Map((postos ?? []).map((p) => [normalizarCNPJ(p.cnpj), p.empresa_id]));

  const registros: LinhaPreco[] = [];
  let erros = 0;

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const cnpj = normalizarCNPJ(texto(linha[COL.cnpj]));
    const combustivel = textoOuNull(linha[COL.produto]);
    const preco = numero(linha[COL.precoPosto]);

    if (!cnpj || !combustivel || preco === null) {
      erros++;
      continue;
    }

    const dataRef = celulaData(linha[COL.dataVigencia]) ?? celulaData(linha[COL.dataAtualizacao]);
    if (!dataRef) {
      erros++;
      continue;
    }

    registros.push({
      cnpj,
      combustivel,
      preco,
      data_ref: dataRef,
      data_atualizacao: celulaData(linha[COL.dataAtualizacao]),
      fonte: "preco_posto.xlsx",
      razao_social: textoOuNull(linha[COL.pontoDeVenda]),
      municipio: textoOuNull(linha[COL.cidade]),
      uf: resolverUf(textoOuNull(linha[COL.uf])),
      empresa_id: empresaPorCnpj.get(cnpj) ?? null,
      codigo_profrotas: textoOuNull(linha[COL.codigoProfrotas]),
      codigo_abadi: textoOuNull(linha[COL.codigoAbadi]),
      preco_anterior: numero(linha[COL.precoAnterior]),
      preco_referencia: numero(linha[COL.precoReferencia]),
      status: textoOuNull(linha[COL.status]),
      status_ponto_venda: textoOuNull(linha[COL.statusPontoVenda]),
      origem_alteracao: textoOuNull(linha[COL.origemAlteracao]),
      bandeira: textoOuNull(linha[COL.bandeira]),
    });
  }

  // Mesmo posto+combustível pode aparecer mais de uma vez na planilha com a
  // mesma data resolvida (ex: duas atualizações no mesmo dia) — o Postgres
  // recusa o upsert nesse caso, então deduplicamos mantendo a última linha.
  const registrosSemDuplicata = dedupePorChave(registros, (r) => `${r.cnpj}__${r.combustivel}__${r.data_ref}`);
  const duplicadas = registros.length - registrosSemDuplicata.length;

  let sucesso = 0;
  const tamanhoLote = 500;
  for (let i = 0; i < registrosSemDuplicata.length; i += tamanhoLote) {
    const lote = registrosSemDuplicata.slice(i, i + tamanhoLote);
    const { error } = await supabase
      .from("historico_precos")
      .upsert(lote, { onConflict: "cnpj,combustivel,data_ref" });
    if (error) {
      return {
        erro: `Falha ao gravar a partir da linha ${i + 2}: ${error.message}. Linhas já gravadas até aqui foram mantidas.`,
      };
    }
    sucesso += lote.length;
  }

  revalidatePath("/postos");
  revalidatePath("/inteligencia-rede");

  return { total: linhas.length - 1, sucesso, erros, duplicadas };
}
