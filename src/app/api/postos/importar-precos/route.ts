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
  exigeEmpresaConhecida: boolean,
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

  // Fase abre-import-precos-cliente — usuário de cliente só pode atualizar
  // preço de posto que já faz parte da rede negociada da SUA empresa (ver
  // comentário grande mais abaixo, junto do carregamento de empresaPorCnpj).
  const empresaId = empresaPorCnpj.get(cnpj) ?? null;
  if (exigeEmpresaConhecida && !empresaId) return null;

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
    empresa_id: empresaId,
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
// exigem perfil admin, e esta foi corrigida pra exigir admin também.
//
// Fase abre-import-precos-cliente (10/08/2026) — Daniel pediu pra abrir essa
// tela: "Importar preco_posto é da operação de cliente. Qualquer usuário
// cliente com permissão deveria poder importar preços de postos do
// relacionamento do cliente." Restringir a admin fazia sentido enquanto a
// rota gravava sem NENHUM filtro (era literalmente cross-tenant irrestrito),
// mas a operação do dia a dia é do cliente atualizar o preço da própria
// rede — não devia depender de um admin.
//
// Desenho adotado (as 3 perguntas foram tiradas a limpo com o Daniel):
//  1. Admin continua com o caminho antigo, sem filtro nenhum: service role,
//     as duas planilhas (Pró-Frotas e modelo padrão), CNPJ sem cliente ainda
//     grava com empresa_id null de propósito (é o uso real: uma planilha da
//     Pró-Frotas mistura postos de vários clientes, muitos ainda não
//     negociados por ninguém).
//  2. Usuário de cliente (qualquer perfil vinculado a uma empresa — inclusive
//     colaborador, não só gestor_frota/analista) pode importar as DUAS
//     planilhas, mas só grava preço de posto que já pertence à rede
//     negociada da própria empresa dele (postos_gf.empresa_id). Linha cujo
//     CNPJ não é encontrado nessa rede é ignorada (vira "erro" no resultado,
//     não cria posto novo nem vaza pra empresa de outro cliente).
//  3. Pra isso o caminho de cliente usa o CLIENTE DE SESSÃO (não o de
//     service role) tanto pra ler postos_gf quanto pra gravar em
//     historico_precos — a RLS (`postos_gf_tenant_all`,
//     `historico_precos_tenant_all`, ambas via `empresas_do_usuario()`) faz
//     a segunda camada de proteção: mesmo que o filtro em código aqui tenha
//     algum bug, o Postgres recusaria de qualquer forma gravar preço fora da
//     rede do usuário. `empresas_do_usuario()` já expande de propósito pras
//     empresas irmãs do mesmo grupo econômico (Rede de Postos) — comportamento
//     documentado e reaproveitado aqui sem precisar de lógica nova.
export async function POST(request: Request) {
  const supabaseSessao = await createClient();
  const { data: perfil } = await supabaseSessao.rpc("perfil_usuario_atual");
  const isAdmin = perfil === "admin";

  // Usuário de cliente precisa estar vinculado a pelo menos uma empresa —
  // sem isso, `empresas_do_usuario()` (e a RLS que depende dela) não libera
  // nenhuma linha de postos_gf, e a importação não teria o que atualizar.
  // Checamos isso antes de processar o arquivo pra dar um erro claro em vez
  // de "100% das linhas deram erro" sem explicação.
  if (!isAdmin) {
    const {
      data: { user },
    } = await supabaseSessao.auth.getUser();
    const { data: minhasEmpresas } = await supabaseSessao.rpc("empresas_do_usuario", {
      p_email: user?.email ?? "",
    });
    if (!minhasEmpresas || minhasEmpresas.length === 0) {
      return NextResponse.json<ResultadoImportacaoPrecos>({
        erro: "Você não está vinculado a nenhuma empresa cliente — não é possível importar preços.",
      });
    }
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

  // Admin: rota cross-tenant por natureza (ver comentário grande acima) —
  // usa service role, enxerga e grava em postos de qualquer cliente, CNPJ
  // sem cliente ainda grava com empresa_id null de propósito.
  //
  // Cliente: usa o cliente de SESSÃO — a RLS de postos_gf e historico_precos
  // já restringe automaticamente à rede do próprio usuário (e das empresas
  // irmãs do mesmo grupo econômico, se houver). Nenhum filtro extra por
  // empresa_id é necessário aqui: o que a SELECT abaixo devolve já É a rede
  // dele.
  const supabase = isAdmin ? createAdminClient() : supabaseSessao;

  // Casa o CNPJ do posto com o cliente dono dele (se já estiver na rede
  // negociada em postos_gf) para preencher empresa_id automaticamente. Pro
  // caminho de cliente, isso também define quais CNPJs são "conhecidos" —
  // os demais são rejeitados logo abaixo.
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

      const empresaId = empresaPorCnpj.get(cnpj) ?? null;
      if (!isAdmin && !empresaId) {
        // CNPJ fora da rede negociada do cliente — não cria posto novo nem
        // atualiza preço de posto de outro cliente.
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
        empresa_id: empresaId,
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
      const registro = montarRegistroGenericoPreco(linhas[i], idx, empresaPorCnpj, !isAdmin);
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
