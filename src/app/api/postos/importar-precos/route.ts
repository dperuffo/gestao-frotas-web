import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerAba, indiceColunas, texto, textoOuNull, numero, data as celulaData, dedupePorChave } from "@/lib/xlsx";
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

// Fase template-padrao-planilhas — pedido do Daniel: além do arquivo
// "preco_posto.xlsx" da integração Pró-Frotas (layout posicional fixo
// acima), também aceitamos um "modelo padrão" genérico — cabeçalho por NOME
// de coluna (qualquer ordem), pra qualquer sistema externo que não seja o
// Pró-Frotas. Baixável em /postos/importar-precos/modelo-padrao. Colunas
// reconhecidas (cabeçalho normalizado entre parênteses; cnpj, combustivel,
// preco e ao menos uma das duas datas são obrigatórias): CNPJ (cnpj) ·
// Combustível (combustivel) · Preço (preco) · Data de Vigência (data de
// vigencia) · Data de Atualização (data de atualizacao) · Razão Social
// (razao social) · Município (municipio) · UF (uf) · Bandeira (bandeira).
function montarRegistroGenericoPreco(
  linha: unknown[],
  idx: Map<string, number>,
  empresaPorCnpj: Map<string, string | null>,
): LinhaPreco | null {
  const pegar = (nomeColuna: string) => {
    const i = idx.get(nomeColuna);
    return i === undefined ? undefined : linha[i];
  };
  const cnpj = normalizarCNPJ(texto(pegar("cnpj")));
  const combustivel = textoOuNull(pegar("combustivel"));
  const preco = numero(pegar("preco"));
  if (!cnpj || !combustivel || preco === null) return null;

  const dataRef = celulaData(pegar("data de vigencia")) ?? celulaData(pegar("data de atualizacao"));
  if (!dataRef) return null;

  return {
    cnpj,
    combustivel,
    preco,
    data_ref: dataRef,
    data_atualizacao: celulaData(pegar("data de atualizacao")),
    fonte: "modelo_padrao.xlsx",
    razao_social: textoOuNull(pegar("razao social")),
    municipio: textoOuNull(pegar("municipio")),
    uf: resolverUf(textoOuNull(pegar("uf"))),
    empresa_id: empresaPorCnpj.get(cnpj) ?? null,
    bandeira: textoOuNull(pegar("bandeira")),
  };
}

// Fase corrige-bloqueio-cloudflare-waf — mesma razão do route.ts de
// /api/postos/importar: trocado de Server Action pra Route Handler pra
// escapar da regra do WAF que confunde o protocolo de Server Actions com o
// CVE-2025-55183 (já corrigido nesta versão do Next, mas o Free plan da
// Cloudflare não deixa criar exceção pra essa regra).
// Bugfix de segurança (09/08/2026, achado C1 da varredura de segurança) —
// esta rota gravava direto em historico_precos usando o cliente de
// SERVICE ROLE sem checar absolutamente nada: nem sessão, nem perfil. Era a
// única das 4 rotas irmãs de importação (postos, postos-anp, importar-precos,
// inteligencia-rede/importar-precos-anp) sem essa checagem — as outras 3 já
// exigem perfil admin, mesmo padrão replicado aqui agora. Confirmado ao vivo
// antes da correção: POST sem nenhuma credencial processava a requisição
// normalmente em produção.
export async function POST(request: Request) {
  const supabaseSessao = await createClient();
  const { data: perfil } = await supabaseSessao.rpc("perfil_usuario_atual");
  if (perfil !== "admin") {
    return NextResponse.json<ResultadoImportacaoPrecos>({
      erro: "Apenas administradores podem importar preços de postos.",
    });
  }

  const formData = await request.formData();

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json<ResultadoImportacaoPrecos>({ erro: "Selecione o arquivo preco_posto.xlsx." });
  }

  const buffer = await arquivo.arrayBuffer();
  const linhasDaAbaProFrotas = lerAba(buffer, "Preços");
  const usaLayoutProFrotas = linhasDaAbaProFrotas.length > 0;
  const linhas = usaLayoutProFrotas ? linhasDaAbaProFrotas : lerAba(buffer);
  if (linhas.length < 2) {
    return NextResponse.json<ResultadoImportacaoPrecos>({ erro: "A planilha está vazia ou não tem nenhuma linha de dados." });
  }

  if (usaLayoutProFrotas) {
    const primeiraCelula = texto(linhas[0][COL.dataVigencia]).toLowerCase();
    if (!primeiraCelula.includes("vig")) {
      return NextResponse.json<ResultadoImportacaoPrecos>({
        erro: 'A primeira coluna da planilha precisa ser "Data de Vigência" — confira se o arquivo enviado é o modelo correto (aba "Preços").',
      });
    }
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

  if (usaLayoutProFrotas) {
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
  } else {
    // Não é o layout Pró-Frotas (não tem aba "Preços") — tratamos como o
    // modelo padrão genérico, mapeando por NOME de cabeçalho (ver
    // montarRegistroGenericoPreco acima).
    const idx = indiceColunas(linhas[0]);
    const temColunasMinimas = idx.has("cnpj") && idx.has("combustivel") && idx.has("preco") &&
      (idx.has("data de vigencia") || idx.has("data de atualizacao"));
    if (!temColunasMinimas) {
      return NextResponse.json<ResultadoImportacaoPrecos>({
        erro:
          'Planilha não reconhecida: envie o arquivo "preco_posto.xlsx" da integração Pró-Frotas (aba "Preços") ou o ' +
          'modelo padrão (colunas "CNPJ", "Combustível", "Preço" e "Data de Vigência") — baixe o modelo padrão na tela de importação.',
      });
    }

    for (let i = 1; i < linhas.length; i++) {
      const registro = montarRegistroGenericoPreco(linhas[i], idx, empresaPorCnpj);
      if (!registro) {
        erros++;
        continue;
      }
      registros.push(registro);
    }
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
      return NextResponse.json<ResultadoImportacaoPrecos>({
        erro: `Falha ao gravar a partir da linha ${i + 2}: ${error.message}. Linhas já gravadas até aqui foram mantidas.`,
      });
    }
    sucesso += lote.length;
  }

  revalidatePath("/postos");
  revalidatePath("/inteligencia-rede");

  return NextResponse.json<ResultadoImportacaoPrecos>({ total: linhas.length - 1, sucesso, erros, duplicadas });
}
